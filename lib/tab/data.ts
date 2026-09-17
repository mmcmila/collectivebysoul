import "server-only";
import { guestDb } from "@/lib/guest/db";
import {
  effectiveDiscount,
  type AuditEntry,
  type BankAccount,
  type DiscountRule,
  type MenuItem,
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
    await sql`SELECT g.id,g.name,g.status,g.created_at,g.round,g.discount_percent,g.pending_method,g.pending_account_id,b.label AS pending_account_label,t.category FROM guest_event.tab_guests g LEFT JOIN guest_event.tickets t ON t.id=g.ticket_id LEFT JOIN guest_event.bank_accounts b ON b.id=g.pending_account_id ORDER BY g.name`;
  const menu =
    await sql`SELECT id,name,price,station,active,sort_order FROM guest_event.menu_items ORDER BY sort_order,name`;
  const lines =
    await sql`SELECT l.id,l.guest_id,l.menu_item_id,l.name,l.price,l.qty,l.station,l.complimentary,l.discount_percent,l.round,l.created_by,COALESCE(a.name,'') AS created_by_name,l.created_at FROM guest_event.tab_lines l LEFT JOIN guest_event.admins a ON a.id=l.created_by ORDER BY l.created_at DESC`;
  const payments =
    await sql`SELECT p.id,p.guest_id,p.amount,p.method,p.bank_account_id,b.label AS account_label,p.round,p.created_by,COALESCE(a.name,'') AS created_by_name,p.created_at FROM guest_event.tab_payments p LEFT JOIN guest_event.admins a ON a.id=p.created_by LEFT JOIN guest_event.bank_accounts b ON b.id=p.bank_account_id ORDER BY p.created_at`;
  const accounts =
    await sql`SELECT id,label,iban,active,sort_order FROM guest_event.bank_accounts ORDER BY sort_order,label`;
  const ruleRows =
    await sql`SELECT r.id,r.kind,r.category,r.guest_id,g.name AS guest_name,r.percent,r.label FROM guest_event.discount_rules r LEFT JOIN guest_event.tab_guests g ON g.id=r.guest_id ORDER BY r.kind,r.created_at`;
  const discountRules = ruleRows.map(
    (r): DiscountRule => ({
      id: r.id,
      kind: r.kind,
      category: r.category,
      guestId: r.guest_id,
      guestName: r.guest_name,
      percent: r.percent,
      label: r.label,
    }),
  );
  const audit =
    user.role === "admin"
      ? await sql`SELECT a.id,a.action,a.record,a.actor_name,a.created_at,COALESCE(g.name,a.record->'guest'->>'name') AS guest_name FROM guest_event.tab_audit a LEFT JOIN guest_event.tab_guests g ON g.id=a.guest_id ORDER BY a.created_at DESC LIMIT 50`
      : [];
  return {
    guests: guests.map((g): TabGuest => {
      const discount = effectiveDiscount(
        {
          id: g.id,
          category: g.category ?? null,
          discountOverride: g.discount_percent,
        },
        discountRules,
      );
      return {
        id: g.id,
        name: g.name,
        status: g.status,
        category: g.category ?? null,
        discountOverride: g.discount_percent,
        discountPercent: discount.percent,
        discountSource: discount.source,
        pendingMethod: g.pending_method,
        pendingAccountId: g.pending_account_id,
        pendingAccountLabel: g.pending_account_label,
        round: g.round,
        createdAt: g.created_at.toISOString(),
      };
    }),
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
        complimentary: l.complimentary,
        discountPercent: l.discount_percent,
        round: l.round,
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
        accountId: p.bank_account_id,
        accountLabel: p.account_label,
        round: p.round,
        createdBy: p.created_by,
        createdByName: p.created_by_name,
        createdAt: p.created_at.toISOString(),
      }),
    ),
    accounts: accounts.map(
      (b): BankAccount => ({
        id: b.id,
        label: b.label,
        iban: b.iban,
        active: b.active,
        sortOrder: b.sort_order,
      }),
    ),
    discountRules,
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
