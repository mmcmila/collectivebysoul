import { cookies } from "next/headers";
import { guestDb } from "./db";
import { hash } from "./session";
export const adminCookie = "soul_admin_session";
export async function currentAdmin() {
 const token=(await cookies()).get(adminCookie)?.value;
 if(!token || !/^[a-f0-9]{64}$/.test(token)) return null;
 const [admin]=await guestDb()`SELECT a.id,a.name FROM guest_event.admin_sessions s JOIN guest_event.admins a ON a.id=s.admin_id WHERE s.token_hash=${hash(token)} AND s.expires_at>now() AND a.active`;
 return admin ? {id:String(admin.id),name:String(admin.name)} : null;
}
