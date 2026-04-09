import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type AttendanceLog = {
  full_name: string;
  identity_no: string;
  shift_title: string | null;
  check_in_at: string;
  check_out_at: string | null;
};

function escapeCsv(val: string) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(inAt: string, outAt: string | null): string {
  if (!outAt) return "Açık";
  const diff = new Date(outAt).getTime() - new Date(inAt).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

export async function GET(req: NextRequest) {
  // Auth check — no redirect(), return 401 JSON instead
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const logName = (searchParams.get("logName") ?? "").trim();
  const logFrom = searchParams.get("logFrom") ?? "";
  const logTo   = searchParams.get("logTo")   ?? "";

  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (logName) {
    conditions.push("u.full_name LIKE ?");
    bindings.push(`%${logName}%`);
  }
  if (logFrom) {
    conditions.push("a.check_in_at >= ?");
    bindings.push(new Date(logFrom).toISOString());
  }
  if (logTo) {
    conditions.push("a.check_in_at <= ?");
    bindings.push(new Date(logTo + "T23:59:59").toISOString());
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT u.full_name, u.identity_no,
              NULL AS shift_title,
              a.check_in_at, a.check_out_at
       FROM attendance_logs a
       INNER JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.check_in_at DESC
       LIMIT 10000`,
    )
    .all(...bindings) as AttendanceLog[];

  const headers = ["Ad Soyad", "Kimlik No", "Giriş", "Çıkış", "Süre"];
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.full_name),
        escapeCsv(row.identity_no),
        escapeCsv(fmt(row.check_in_at)),
        escapeCsv(row.check_out_at ? fmt(row.check_out_at) : "Açık"),
        escapeCsv(duration(row.check_in_at, row.check_out_at)),
      ].join(","),
    );
  }

  // UTF-8 BOM — Excel Türkçe karakterleri doğru okur
  const csv = "\uFEFF" + lines.join("\r\n");
  const filename = `yoklama-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
