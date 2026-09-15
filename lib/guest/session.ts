import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { guestDb } from "./db";
export const cookieName = "soul_guest_session";
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function currentGuest() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await guestDb()`SELECT t.id, t.name, t.is_demo FROM guest_event.sessions s JOIN guest_event.tickets t ON t.id=s.ticket_id WHERE s.token_hash=${hash(token)} AND s.expires_at>now() AND t.active`;
  return rows[0] ?? null;
}
