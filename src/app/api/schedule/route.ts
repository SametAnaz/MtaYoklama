import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type ScheduleRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId gereklidir." }, { status: 400 });
  }

  const rows = db
    .prepare(
      "SELECT day_of_week, start_time, end_time FROM user_schedules WHERE user_id = ? ORDER BY day_of_week",
    )
    .all(userId) as ScheduleRow[];

  return NextResponse.json({ schedules: rows });
}
