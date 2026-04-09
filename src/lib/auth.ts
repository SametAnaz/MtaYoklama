import { redirect } from "next/navigation";
import { db, type AppRole, type UserRow } from "@/lib/db";
import { getSession } from "@/lib/session";

export type CurrentUser = Omit<UserRow, "password_hash">;

export function normalizeIdentityNo(identityNo: string) {
  return identityNo.replace(/\D/g, "");
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const user = db
    .prepare(
      "SELECT id, identity_no, full_name, role FROM users WHERE id = ? LIMIT 1",
    )
    .get(session.user_id) as CurrentUser | undefined;

  return user ?? null;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireRole(role: AppRole) {
  await requireUser();
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== role) {
    redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }

  return profile;
}
