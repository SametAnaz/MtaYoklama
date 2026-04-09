import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

/* ─── Types ─── */
type AbsenceRow = {
  full_name: string;
  identity_no: string;
  work_date: string;
  start_time: string;
  end_time: string;
};

type MonthlyRow = {
  full_name: string;
  identity_no: string;
  year_month: string;
  total_minutes: number;
  session_count: number;
};

/* ─── Helpers ─── */
const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function hm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

/** 7.5 saat = 1 is gunu */
function calcDays(minutes: number): string {
  const raw = minutes / 450; // 450 dk = 7.5 saat
  const rounded = Math.round(raw * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });
}

function escapeCsv(val: string) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n"); // UTF-8 BOM for Turkish chars
}

/* ─── Handler ─── */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const report = sp.get("report") ?? "absence";
  const format = sp.get("format") ?? "excel"; // "csv" | "excel"
  const userId = sp.get("userId") ?? "";

  /* ══ ABSENCE REPORT ══ */
  if (report === "absence") {
    const absFrom = sp.get("absFrom") ?? "";
    const absTo   = sp.get("absTo")   ?? "";

    const fromDate = absFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate   = absTo   || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const bindings: string[] = [fromDate, toDate];
    const userWhere = userId ? "AND u.id = ?" : "";
    if (userId) bindings.push(userId);

    const rows = db
      .prepare(
        `WITH RECURSIVE dates(d) AS (
           SELECT date(?)
           UNION ALL
           SELECT date(d, '+1 day') FROM dates WHERE d < date(?)
         )
         SELECT u.full_name, u.identity_no, d.d AS work_date,
                us.start_time, us.end_time
         FROM dates d
         CROSS JOIN users u
         INNER JOIN user_schedules us
           ON us.user_id = u.id AND us.day_of_week = CAST(strftime('%w', d.d) AS INTEGER)
         WHERE u.role = 'staff' AND u.is_active = 1
           ${userWhere}
           AND NOT EXISTS (
             SELECT 1 FROM attendance_logs a
             WHERE a.user_id = u.id AND date(a.check_in_at) = d.d
           )
         ORDER BY d.d DESC, u.full_name
         LIMIT 5000`,
      )
      .all(...bindings) as AbsenceRow[];

    const headers = ["Ad Soyad", "Kimlik No", "Tarih", "Gun", "Baslangic", "Bitis"];
    const dataRows = rows.map((r) => [
      r.full_name,
      r.identity_no,
      r.work_date,
      dayNames[new Date(r.work_date + "T12:00:00").getDay()],
      r.start_time,
      r.end_time,
    ]);

    const filename = `devamsizlik-${fromDate}_${toDate}`;

    if (format === "csv") {
      return new NextResponse(toCsv(headers, dataRows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Devamsizlik");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  /* ══ MONTHLY REPORT ══ */
  if (report === "monthly") {
    const monthYear = sp.get("monthYear") ?? new Date().toISOString().slice(0, 7);
    const [y, m] = monthYear.split("-");
    const monthStart = `${y}-${m}-01T00:00:00.000Z`;
    const monthEnd   = new Date(Number(y), Number(m), 1).toISOString();

    const bindings: string[] = [monthStart, monthEnd];
    const userWhere = userId ? "AND a.user_id = ?" : "";
    if (userId) bindings.push(userId);

    const rows = db
      .prepare(
        `SELECT u.full_name, u.identity_no,
                strftime('%Y-%m', a.check_in_at) AS year_month,
                SUM(
                  CASE WHEN a.check_out_at IS NOT NULL
                  THEN CAST((julianday(a.check_out_at) - julianday(a.check_in_at)) * 24 * 60 AS INTEGER)
                  ELSE 0 END
                ) AS total_minutes,
                COUNT(*) AS session_count
         FROM attendance_logs a
         INNER JOIN users u ON u.id = a.user_id
         WHERE a.check_in_at >= ? AND a.check_in_at < ?
           ${userWhere}
         GROUP BY a.user_id, year_month
         ORDER BY u.full_name`,
      )
      .all(...bindings) as MonthlyRow[];

    const headers = ["Ay", "Ad Soyad", "Kimlik No", "Yoklama Sayisi", "Toplam Sure", "Is Gunu (7.5s=1)", "Ort. / Seans", "Toplam Dakika"];
    const dataRows = rows.map((r) => [
      fmtMonth(r.year_month),
      r.full_name,
      r.identity_no,
      String(r.session_count),
      hm(r.total_minutes),
      calcDays(r.total_minutes),
      hm(Math.round(r.total_minutes / r.session_count)),
      String(r.total_minutes),
    ]);

    const filename = `aylik-ozet-${monthYear}`;

    if (format === "csv") {
      return new NextResponse(toCsv(headers, dataRows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Aylik Ozet");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: "Bilinmeyen rapor tipi" }, { status: 400 });
}
