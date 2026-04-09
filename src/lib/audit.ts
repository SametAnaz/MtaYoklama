import { db } from "@/lib/db";

export function writeAudit(params: {
  actorId: string;
  actorName: string;
  action: string;
  target?: string;
  detail?: string;
}) {
  db.prepare(
    "INSERT INTO audit_logs (actor_id, actor_name, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    params.actorId,
    params.actorName,
    params.action,
    params.target ?? null,
    params.detail ?? null,
    new Date().toISOString(),
  );
}
