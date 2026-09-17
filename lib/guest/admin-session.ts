import "server-only";
import { cache } from "react";
import { isStaffRole, type StaffRole, type StaffUser } from "@/lib/tab/types";
import { guestDb } from "./db";
import { hash, readSessionToken } from "./session";

export const adminCookie = "soul_admin_session";

/** Any signed-in staff account: organiser (admin), bar or pizza. */
export const currentAdmin = cache(async (): Promise<StaffUser | null> => {
  const token = await readSessionToken(adminCookie);
  if (!token) return null;
  const [admin] =
    await guestDb()`SELECT a.id,a.name,a.role FROM guest_event.admin_sessions s JOIN guest_event.admins a ON a.id=s.admin_id WHERE s.token_hash=${hash(token)} AND s.expires_at>now() AND a.active`;
  if (!admin) return null;
  const role: StaffRole = isStaffRole(admin.role) ? admin.role : "admin";
  return { id: String(admin.id), name: String(admin.name), role };
});

/** Organiser only: the management console and its actions. */
export const currentOrganiser = cache(async () => {
  const admin = await currentAdmin();
  return admin?.role === "admin" ? admin : null;
});
