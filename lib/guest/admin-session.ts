import "server-only";
import { cache } from "react";
import { guestDb } from "./db";
import { hash, readSessionToken } from "./session";

export const adminCookie = "soul_admin_session";

export const currentAdmin = cache(async () => {
  const token = await readSessionToken(adminCookie);
  if (!token) return null;
  const [admin] =
    await guestDb()`SELECT a.id,a.name FROM guest_event.admin_sessions s JOIN guest_event.admins a ON a.id=s.admin_id WHERE s.token_hash=${hash(token)} AND s.expires_at>now() AND a.active`;
  return admin ? { id: String(admin.id), name: String(admin.name) } : null;
});
