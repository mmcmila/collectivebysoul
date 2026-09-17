import "server-only";
import { guestDb } from "@/lib/guest/db";
import type {
  AuditEntry,
  MenuItem,
  StaffUser,
  TabData,
  TabGuest,
  TabLine,
  TabPayment,
} from "./types";

export async function loadTabData(user: StaffUser): Promise<TabData> {
  const sql = guestDb();
  // Queries run one after another on purpose: the Supabase transaction
  // pooler stalls when this app opens several connections at once, and
  // each query is small (~150 ms), so sequential is both safe and fast.
  const guests =
    await sql`SELECT id,name,status,created_at FROM guest_event.tab_guests ORDER BY name`;
  const menu =
    await sql`SELECT id,name,price,station,active,sort_order FROM guest_event.menu_items ORDER BY sort_order,name`;
  const lines =
    await sql`SELECT l.id,l.guest_id,l.menu_item_id,l.name,l.price,l.qty,l.station,l.created_by,COALESCE(a.name,'') AS created_by_name,l.created_at FROM guest_event.tab_lines l LEFT JOIN guest_event.admins a ON a.id=l.created_by ORDER BY l.created_at DESC`;
  const payments =
    await sql`SELECT p.id,p.guest_id,p.amount,p.method,p.created_by,COALESCE(a.name,'') AS created_by_name,p.created_at FROM guest_event.tab_payments p LEFT JOIN guest_event.admins a ON a.id=p.created_by ORDER BY p.created_at`;
  const settings =
    await sql`SELECT value FROM guest_event.settings WHERE key='bar_iban'`;
  const audit =
    user.role === "admin"
      ? await sql`SELECT a.id,a.action,a.record,a.actor_name,a.created_at,COALESCE(g.name,a.record->'guest'->>'name') AS guest_name FROM guest_event.tab_audit a LEFT JOIN guest_event.tab_guests g ON g.id=a.guest_id ORDER BY a.created_at DESC LIMIT 50`
      : [];
  return {
    guests: guests.map(
      (g): TabGuest => ({
        id: g.id,
        name: g.name,
        status: g.status,
        createdAt: g.created_at.toISOString(),
      }),
    ),
    menu: menu.map(
      (m): MenuItem => ({
        id: m.id,
        name: m.name,
        price: m.price,
        station: m.station,
        active: m.active,
        sortOrder: m.sort_order,
      }),
    ),
    lines: lines.map(
      (l): TabLine => ({
        id: l.id,
        guestId: l.guest_id,
        menuItemId: l.menu_item_id,
        name: l.name,
        price: l.price,
        qty: l.qty,
        station: l.station,
        createdBy: l.created_by,
        createdByName: l.created_by_name,
        createdAt: l.created_at.toISOString(),
      }),
    ),
    payments: payments.map(
      (p): TabPayment => ({
        id: p.id,
        guestId: p.guest_id,
        amount: p.amount,
        method: p.method,
        createdBy: p.created_by,
        createdByName: p.created_by_name,
        createdAt: p.created_at.toISOString(),
      }),
    ),
    iban: settings[0]?.value ?? "",
    audit: (audit as { id: string; action: string; record: Record<string, unknown>; actor_name: string; created_at: Date; guest_name: string | null }[]).map(
      (a): AuditEntry => ({
        id: a.id,
        action: a.action,
        guestName: a.guest_name,
        record: a.record,
        actorName: a.actor_name,
        createdAt: a.created_at.toISOString(),
      }),
    ),
    fetchedAt: new Date().toISOString(),
  };
}
