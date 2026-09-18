"use server";
import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import type postgres from "postgres";

import { currentAdmin, currentOrganiser } from "@/lib/guest/admin-session";
import { guestDb, UserError } from "@/lib/guest/db";
import { hash } from "@/lib/guest/session";
import {
  canDeleteEntry,
  canDeleteRecord,
  guestTotals,
  hasActivity,
  resolvePaymentAmount,
  startsNewRound,
  stationForRole,
  tabStatus,
} from "@/lib/tab/calc";
import { loadTabData } from "@/lib/tab/data";
import {
  effectiveDiscount,
  isPaymentMethod,
  isStaffRole,
  isStation,
  type AuditEntry,
  type BankAccountDraft,
  type DiscountRuleDraft,
  type MenuDraftItem,
  type StaffAccount,
  type StaffRole,
  type StaffUser,
  type TabData,
  type TabLine,
  type TabPayment,
  type TabStatus,
} from "@/lib/tab/types";

const SESSION_ERROR = "Oturumun sona erdi. Yeniden giriş yap.";
const ADMIN_ERROR = "Bu işlem için yönetici yetkisi gerekiyor.";

const isUuid = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);

const cleanName = (name: unknown) =>
  typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";

type Failure = { ok: false; error: string };
const fail = (error: unknown, fallback: string): Failure => ({
  ok: false,
  error: error instanceof UserError ? error.message : fallback,
});
const ok = <T extends object>(value: T) => ({
  ok: true as const,
  error: undefined,
  ...value,
});

type Tx = postgres.TransactionSql;

/** Locks the guest row so balance checks and status changes are serialised per guest. */
async function lockGuest(tx: Tx, guestId: string) {
  const [guest] =
    await tx`SELECT g.id,g.name,g.status,g.round,g.discount_percent,t.category FROM guest_event.tab_guests g LEFT JOIN guest_event.tickets t ON t.id=g.ticket_id WHERE g.id=${guestId} FOR UPDATE OF g`;
  if (!guest) throw new UserError("Bu misafir silinmiş. Listeyi yenile.");
  return guest as {
    id: string;
    name: string;
    status: TabStatus;
    round: number;
    discount_percent: number | null;
    category: string | null;
  };
}

/** Discount a new line gets right now: override, else personal rule, else type rule. */
async function currentDiscount(
  tx: Tx,
  guest: { id: string; category: string | null; discount_percent: number | null },
) {
  const rules = await tx<
    { kind: "category" | "guest"; category: "paid" | "team" | "guest" | null; guestId: string | null; percent: number; label: string }[]
  >`SELECT kind,category,guest_id AS "guestId",percent,label FROM guest_event.discount_rules WHERE (kind='guest' AND guest_id=${guest.id}) OR (kind='category' AND category=${guest.category})`;
  return effectiveDiscount(
    { id: guest.id, category: guest.category, discountOverride: guest.discount_percent },
    rules,
  ).percent;
}

/** Balance of the guest's current round only; closed rounds are settled history. */
async function balance(tx: Tx, guestId: string, round: number) {
  const lines = await tx<
    { guestId: string; price: number; qty: number; complimentary: boolean; discountPercent: number; round: number }[]
  >`SELECT guest_id AS "guestId",price,qty,complimentary,discount_percent AS "discountPercent",round FROM guest_event.tab_lines WHERE guest_id=${guestId} AND round=${round}`;
  const payments = await tx<{ guestId: string; amount: number; round: number }[]>`SELECT guest_id AS "guestId",amount,round FROM guest_event.tab_payments WHERE guest_id=${guestId} AND round=${round}`;
  return guestTotals(lines, payments, guestId, round);
}

/**
 * A round emptied by deletions is dropped: the guest falls back to the last
 * round that still has entries, so someone who paid stays under "Kapalı"
 * instead of looking like a tab that was never opened.
 */
async function dropEmptyRounds(tx: Tx, guestId: string, round: number) {
  let current = round;
  while (current > 1 && !hasActivity(await balance(tx, guestId, current)))
    current -= 1;
  if (current !== round)
    await tx`UPDATE guest_event.tab_guests SET round=${current} WHERE id=${guestId}`;
  return current;
}

/** Keeps the stored status in line with the balance: owed = open, settled = closed. */
async function syncStatus(tx: Tx, guestId: string, round: number) {
  const status = tabStatus(await balance(tx, guestId, round));
  await tx`UPDATE guest_event.tab_guests SET status=${status} WHERE id=${guestId} AND status<>${status}`;
  return status;
}

async function audit(
  tx: Tx,
  user: StaffUser,
  action: string,
  guestId: string | null,
  record: unknown,
) {
  await tx`INSERT INTO guest_event.tab_audit(action,guest_id,record,actor_id,actor_name) VALUES(${action},${guestId},${tx.json(record as Parameters<typeof tx.json>[0])},${user.id},${user.name})`;
}

export async function getTabData(): Promise<TabData> {
  const user = await currentAdmin();
  if (!user) redirect("/yonetim/adisyon");
  return loadTabData(user);
}

export async function addTabGuest(name: string) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  const clean = cleanName(name);
  if (clean.length < 1 || clean.length > 120)
    return fail(null, "Misafir adı 1–120 karakter olmalı.");
  try {
    const [guest] =
      await guestDb()`INSERT INTO guest_event.tab_guests(name) VALUES(${clean}) RETURNING id`;
    return ok({ id: String(guest.id) });
  } catch {
    return fail(null, "Misafir eklenemedi. Tekrar dene.");
  }
}

export async function addTabGuestsBulk(text: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (typeof text !== "string" || text.length > 20000)
    return fail(null, "Liste çok uzun.");
  const names = [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => cleanName(line))
        .filter((line) => line.length >= 1 && line.length <= 120),
    ),
  ];
  if (!names.length) return fail(null, "Her satıra bir isim yaz.");
  try {
    await guestDb().begin(async (tx) => {
      for (const name of names)
        await tx`INSERT INTO guest_event.tab_guests(name) VALUES(${name})`;
    });
    return ok({ count: names.length });
  } catch {
    return fail(null, "Liste eklenemedi. Tekrar dene.");
  }
}

export async function deleteTabGuest(guestId: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!isUuid(guestId)) return fail(null, "Geçersiz misafir.");
  try {
    await guestDb().begin(async (tx) => {
      const guest = await lockGuest(tx, guestId);
      const lines =
        await tx`SELECT id,name,price,qty,station,complimentary,created_by,created_at FROM guest_event.tab_lines WHERE guest_id=${guestId}`;
      const payments =
        await tx`SELECT id,amount,method,created_by,created_at FROM guest_event.tab_payments WHERE guest_id=${guestId}`;
      await audit(tx, user, "guest.delete", guestId, {
        guest,
        lines,
        payments,
      });
      await tx`DELETE FROM guest_event.tab_guests WHERE id=${guestId}`;
    });
    return ok({});
  } catch (e) {
    return fail(e, "Misafir silinemedi.");
  }
}

export async function addTabLine(guestId: string, menuItemId: string) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!isUuid(guestId) || !isUuid(menuItemId))
    return fail(null, "Geçersiz misafir veya ürün.");
  try {
    const result = await guestDb().begin(async (tx) => {
      const guest = await lockGuest(tx, guestId);
      const [item] =
        await tx`SELECT id,name,price,station FROM guest_event.menu_items WHERE id=${menuItemId} AND active`;
      if (!item)
        throw new UserError("Bu ürün artık menüde yok. Menüyü yenile.");
      // Always a new row: two stations adding at once never overwrite each other.
      // The discount in force now is copied onto the line and never changes.
      const discountPercent = await currentDiscount(tx, guest);
      // An order on a fully paid tab starts a new round on the same profile;
      // the paid round stays as history.
      let round = guest.round;
      if (startsNewRound(await balance(tx, guestId, guest.round))) {
        round = guest.round + 1;
        await tx`UPDATE guest_event.tab_guests SET round=${round} WHERE id=${guestId}`;
      }
      const [line] =
        await tx`INSERT INTO guest_event.tab_lines(guest_id,menu_item_id,name,price,qty,station,discount_percent,round,created_by) VALUES(${guestId},${item.id},${item.name},${item.price},1,${item.station},${discountPercent},${round},${user.id}) RETURNING id,created_at`;
      const created: TabLine = {
        id: line.id,
        guestId,
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        station: item.station,
        complimentary: false,
        discountPercent,
        round,
        createdBy: user.id,
        createdByName: user.name,
        createdAt: line.created_at.toISOString(),
      };
      return { line: created, status: await syncStatus(tx, guestId, round) };
    });
    return ok(result);
  } catch (e) {
    return fail(e, "Ürün eklenemedi. Tekrar dene.");
  }
}

export async function deleteTabLine(lineId: string) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!isUuid(lineId)) return fail(null, "Geçersiz kalem.");
  try {
    await guestDb().begin(async (tx) => {
      const [line] =
        await tx`SELECT id,guest_id,menu_item_id,name,price,qty,station,complimentary,round,created_by,created_at FROM guest_event.tab_lines WHERE id=${lineId} FOR UPDATE`;
      if (!line) throw new UserError("Bu kalem zaten silinmiş.");
      if (!canDeleteEntry(user))
        throw new UserError("Bu kalemi silme yetkin yok.");
      const owner = await lockGuest(tx, line.guest_id);
      // Paid history is locked for staff; only the organiser may clean it up.
      if (line.round !== owner.round && user.role !== "admin")
        throw new UserError("Kapanmış eski hesaba ait kalemi yalnızca yönetici silebilir.");
      await audit(tx, user, "line.delete", line.guest_id, line);
      await tx`DELETE FROM guest_event.tab_lines WHERE id=${lineId}`;
      if (line.round === owner.round)
        await syncStatus(
          tx,
          line.guest_id,
          await dropEmptyRounds(tx, line.guest_id, owner.round),
        );
    });
    return ok({});
  } catch (e) {
    return fail(e, "Kalem silinemedi.");
  }
}

export async function addTabPayment(
  guestId: string,
  amount: number | null,
  method: string,
  accountId: string | null = null,
) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!isUuid(guestId) || !isPaymentMethod(method))
    return fail(null, "Geçersiz misafir veya ödeme yöntemi.");
  if (amount !== null && (typeof amount !== "number" || amount > 100_000_000))
    return fail(null, "Tutarı kontrol et.");
  if (method === "iban" && !isUuid(accountId))
    return fail(null, "Hangi IBAN'a ödendiğini seç.");
  try {
    const result = await guestDb().begin(async (tx) => {
      const guest = await lockGuest(tx, guestId);
      let account: { id: string; label: string } | null = null;
      if (method === "iban") {
        const [row] =
          await tx`SELECT id,label FROM guest_event.bank_accounts WHERE id=${accountId as string} AND active`;
        if (!row) throw new UserError("Bu IBAN artık kullanımda değil. Ayarları yenile.");
        account = { id: row.id, label: row.label };
      }
      const { due } = await balance(tx, guestId, guest.round);
      const resolved = resolvePaymentAmount(amount, due);
      if ("error" in resolved) throw new UserError(resolved.error);
      const [payment] =
        await tx`INSERT INTO guest_event.tab_payments(guest_id,amount,method,bank_account_id,round,created_by) VALUES(${guestId},${resolved.amount},${method},${account?.id ?? null},${guest.round},${user.id}) RETURNING id,created_at`;
      // A recorded payment ends any "will pay by IBAN later" state.
      await tx`UPDATE guest_event.tab_guests SET pending_method=NULL,pending_account_id=NULL WHERE id=${guestId} AND pending_method IS NOT NULL`;
      // Nothing left to pay closes the tab; a balance keeps it open.
      const status = await syncStatus(tx, guestId, guest.round);
      const created: TabPayment = {
        id: payment.id,
        guestId,
        amount: resolved.amount,
        method,
        accountId: account?.id ?? null,
        accountLabel: account?.label ?? null,
        round: guest.round,
        createdBy: user.id,
        createdByName: user.name,
        createdAt: payment.created_at.toISOString(),
      };
      return { payment: created, status };
    });
    return ok(result);
  } catch (e) {
    return fail(e, "Ödeme kaydedilemedi. Tekrar dene.");
  }
}

export async function deleteTabPayment(paymentId: string) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!isUuid(paymentId)) return fail(null, "Geçersiz ödeme.");
  try {
    await guestDb().begin(async (tx) => {
      const [payment] =
        await tx`SELECT id,guest_id,amount,method,bank_account_id,round,created_by,created_at FROM guest_event.tab_payments WHERE id=${paymentId} FOR UPDATE`;
      if (!payment) throw new UserError("Bu ödeme zaten silinmiş.");
      if (!canDeleteEntry(user))
        throw new UserError("Bu ödemeyi silme yetkin yok.");
      const guest = await lockGuest(tx, payment.guest_id);
      if (payment.round !== guest.round && user.role !== "admin")
        throw new UserError("Kapanmış eski hesaba ait ödemeyi yalnızca yönetici silebilir.");
      await audit(tx, user, "payment.delete", payment.guest_id, payment);
      await tx`DELETE FROM guest_event.tab_payments WHERE id=${paymentId}`;
      // A payment removed from paid history does not touch the current round.
      if (payment.round !== guest.round) return;
      await syncStatus(
        tx,
        payment.guest_id,
        await dropEmptyRounds(tx, payment.guest_id, guest.round),
      );
    });
    return ok({});
  } catch (e) {
    return fail(e, "Ödeme silinemedi.");
  }
}

/** The guest will transfer later: the tab stays open and shows "IBAN bekleniyor". */
export async function markIbanPending(guestId: string, accountId: string | null) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!isUuid(guestId) || (accountId !== null && !isUuid(accountId)))
    return fail(null, "Geçersiz misafir veya IBAN.");
  try {
    await guestDb().begin(async (tx) => {
      await lockGuest(tx, guestId);
      if (accountId) {
        const [row] =
          await tx`SELECT id FROM guest_event.bank_accounts WHERE id=${accountId} AND active`;
        if (!row) throw new UserError("Bu IBAN artık kullanımda değil.");
      }
      await tx`UPDATE guest_event.tab_guests SET status='open',pending_method='iban',pending_account_id=${accountId} WHERE id=${guestId}`;
    });
    return ok({});
  } catch (e) {
    return fail(e, "Kaydedilemedi.");
  }
}

export async function clearPending(guestId: string) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!isUuid(guestId)) return fail(null, "Geçersiz misafir.");
  try {
    await guestDb()`UPDATE guest_event.tab_guests SET pending_method=NULL,pending_account_id=NULL WHERE id=${guestId}`;
    return ok({});
  } catch {
    return fail(null, "Kaydedilemedi.");
  }
}

const validPercent = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;

/**
 * Personal discount override for new lines: a percentage, 0 to remove any
 * discount despite the rules, or null to follow the rules again. Lines
 * already on the tab keep the discount they were added with. Admin only.
 */
export async function setGuestDiscount(guestId: string, percent: number | null) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!isUuid(guestId) || (percent !== null && !validPercent(percent)))
    return fail(null, "İndirim 0–100 arasında bir yüzde olmalı.");
  try {
    await guestDb().begin(async (tx) => {
      const guest = await lockGuest(tx, guestId);
      await tx`UPDATE guest_event.tab_guests SET discount_percent=${percent} WHERE id=${guestId}`;
      await audit(tx, user, "guest.discount", guestId, {
        name: guest.name,
        discountPercent: percent ?? (await currentDiscount(tx, { ...guest, discount_percent: null })),
        override: percent,
        previous: guest.discount_percent,
      });
    });
    return ok({});
  } catch (e) {
    return fail(e, "İndirim kaydedilemedi.");
  }
}

/** Replaces the discount rules (type-based and personal). Admin only. */
export async function saveDiscountRules(items: DiscountRuleDraft[]) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!Array.isArray(items) || items.length > 100)
    return fail(null, "İndirim kuralları kaydedilemedi.");
  const clean = items.map((r) => ({
    id: r?.id === null ? null : r?.id,
    kind: r?.kind,
    category: r?.kind === "category" ? r?.category : null,
    guestId: r?.kind === "guest" ? r?.guestId : null,
    percent: r?.percent,
    label: cleanName(r?.label).slice(0, 80),
  }));
  for (const r of clean) {
    if (r.id !== null && !isUuid(r.id)) return fail(null, "Geçersiz kural.");
    if (r.kind !== "category" && r.kind !== "guest") return fail(null, "Kural türünü seç.");
    if (r.kind === "category" && !["paid", "team", "guest"].includes(String(r.category)))
      return fail(null, "Katılımcı türünü seç.");
    if (r.kind === "guest" && !isUuid(r.guestId)) return fail(null, "Kişiye özel kural için misafir seç.");
    if (!validPercent(r.percent)) return fail(null, "İndirim 0–100 arasında bir yüzde olmalı.");
  }
  try {
    await guestDb().begin(async (tx) => {
      const keep = clean.filter((r) => r.id !== null).map((r) => r.id as string);
      await tx`DELETE FROM guest_event.discount_rules WHERE id<>ALL(${keep}::uuid[])`;
      for (const r of clean) {
        if (r.id === null)
          await tx`INSERT INTO guest_event.discount_rules(kind,category,guest_id,percent,label) VALUES(${r.kind as string},${r.category ?? null},${r.guestId ?? null},${r.percent as number},${r.label})`;
        else
          await tx`UPDATE guest_event.discount_rules SET kind=${r.kind as string},category=${r.category ?? null},guest_id=${r.guestId ?? null},percent=${r.percent as number},label=${r.label} WHERE id=${r.id}`;
      }
      await audit(tx, user, "discount.rules", null, { rules: clean });
    });
    return ok({});
  } catch {
    return fail(null, "İndirim kuralları kaydedilemedi. Tekrar dene.");
  }
}

/** Marks a line as a free "ikram"; it stays listed but is charged as 0 ₺. */
export async function setLineComplimentary(lineId: string, complimentary: boolean) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!isUuid(lineId) || typeof complimentary !== "boolean")
    return fail(null, "Geçersiz kalem.");
  try {
    await guestDb().begin(async (tx) => {
      const [line] =
        await tx`SELECT id,guest_id,name,price,qty,round,created_by FROM guest_event.tab_lines WHERE id=${lineId} FOR UPDATE`;
      if (!line) throw new UserError("Bu kalem silinmiş.");
      if (!canDeleteRecord(user, { createdBy: line.created_by }))
        throw new UserError("Sadece kalemi giren kişi veya yönetici ikram yapabilir.");
      const owner = await lockGuest(tx, line.guest_id);
      if (line.round !== owner.round)
        throw new UserError("Kapanmış eski hesaba ait kalem değiştirilemez.");
      await tx`UPDATE guest_event.tab_lines SET complimentary=${complimentary} WHERE id=${lineId}`;
      // "İkram" changes the balance, so the tab may close or open again.
      await syncStatus(tx, line.guest_id, owner.round);
      await audit(tx, user, "line.complimentary", line.guest_id, {
        ...line,
        complimentary,
      });
    });
    return ok({});
  } catch (e) {
    return fail(e, "Kaydedilemedi.");
  }
}

/** Removes a product from the menu; past lines keep their snapshot. Admin only. */
export async function deleteMenuItem(itemId: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!isUuid(itemId)) return fail(null, "Geçersiz ürün.");
  try {
    await guestDb().begin(async (tx) => {
      const [item] =
        await tx`DELETE FROM guest_event.menu_items WHERE id=${itemId} RETURNING id,name,price,station`;
      if (item) await audit(tx, user, "menu.delete", null, item);
    });
    return ok({});
  } catch {
    return fail(null, "Ürün silinemedi.");
  }
}

/** Removes an IBAN that no payment refers to; otherwise make it passive. Admin only. */
export async function deleteBankAccount(accountId: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!isUuid(accountId)) return fail(null, "Geçersiz IBAN.");
  try {
    await guestDb().begin(async (tx) => {
      const [used] =
        await tx`SELECT count(*)::int AS n FROM guest_event.tab_payments WHERE bank_account_id=${accountId}`;
      if (used.n > 0)
        throw new UserError(
          "Bu IBAN'a ödeme kaydedilmiş; silmek yerine pasife al.",
        );
      await tx`UPDATE guest_event.tab_guests SET pending_account_id=NULL WHERE pending_account_id=${accountId}`;
      const [account] =
        await tx`DELETE FROM guest_event.bank_accounts WHERE id=${accountId} RETURNING id,label,iban`;
      if (account) await audit(tx, user, "account.delete", null, account);
    });
    return ok({});
  } catch (e) {
    return fail(e, "IBAN silinemedi.");
  }
}

/**
 * Adds one product to the menu. Open to all staff so a missing drink can be
 * entered at the bar; staff add to their own station only. Editing prices and
 * deleting stay with the organiser, and the addition is logged.
 */
export async function addMenuItem(name: string, price: number, station: string) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  const clean = cleanName(name);
  if (clean.length < 1 || clean.length > 80)
    return fail(null, "Ürün adı 1–80 karakter olmalı.");
  if (
    typeof price !== "number" ||
    !Number.isInteger(price) ||
    price < 0 ||
    price > 100_000_000
  )
    return fail(null, "Fiyatı kontrol et.");
  const target = user.role === "admin" ? station : stationForRole(user.role);
  if (!isStation(target)) return fail(null, "İstasyon seç.");
  try {
    await guestDb().begin(async (tx) => {
      const [same] =
        await tx`SELECT id FROM guest_event.menu_items WHERE lower(name)=lower(${clean}) AND active LIMIT 1`;
      if (same) throw new UserError("Bu ürün menüde zaten var.");
      const [item] =
        await tx`INSERT INTO guest_event.menu_items(name,price,station,active,sort_order) SELECT ${clean},${price},${target},true,COALESCE(max(sort_order),0)+1 FROM guest_event.menu_items RETURNING id,name,price,station`;
      await audit(tx, user, "menu.create", null, item);
    });
    return ok({});
  } catch (e) {
    return fail(e, "Ürün eklenemedi. Tekrar dene.");
  }
}

/**
 * Saves the menu editor: new products, prices, names, sections and hiding what
 * ran out (active). Open to all staff; every change is written to the activity
 * log. Deleting a product for good is deleteMenuItem (admin only).
 */
export async function saveMenu(items: MenuDraftItem[]) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!Array.isArray(items) || items.length > 200)
    return fail(null, "Menü kaydedilemedi.");
  const clean = items.map((item, index) => ({
    id: item?.id === null ? null : item?.id,
    name: cleanName(item?.name),
    price: item?.price,
    station: item?.station,
    active: item?.active === true,
    sortOrder: index + 1,
  }));
  for (const item of clean) {
    if (item.id !== null && !isUuid(item.id)) return fail(null, "Geçersiz ürün.");
    if (item.name.length < 1 || item.name.length > 80)
      return fail(null, "Her ürünün 1–80 karakterlik bir adı olmalı.");
    if (
      typeof item.price !== "number" ||
      !Number.isInteger(item.price) ||
      item.price < 0 ||
      item.price > 100_000_000
    )
      return fail(null, `"${item.name}" için fiyatı kontrol et.`);
    if (!isStation(item.station))
      return fail(null, `"${item.name}" için istasyon seç.`);
  }
  try {
    await guestDb().begin(async (tx) => {
      const before = new Map(
        (
          await tx<
            { id: string; name: string; price: number; station: string; active: boolean }[]
          >`SELECT id,name,price,station,active FROM guest_event.menu_items FOR UPDATE`
        ).map((row) => [row.id, row]),
      );
      for (const item of clean) {
        const now = {
          name: item.name,
          price: item.price as number,
          station: item.station as string,
          active: item.active,
        };
        if (item.id === null) {
          await tx`INSERT INTO guest_event.menu_items(name,price,station,active,sort_order) VALUES(${now.name},${now.price},${now.station},${now.active},${item.sortOrder})`;
          await audit(tx, user, "menu.create", null, now);
          continue;
        }
        const old = before.get(item.id);
        if (!old) continue; // deleted meanwhile by the organiser
        await tx`UPDATE guest_event.menu_items SET name=${now.name},price=${now.price},station=${now.station},active=${now.active},sort_order=${item.sortOrder} WHERE id=${item.id}`;
        if (
          old.name !== now.name ||
          old.price !== now.price ||
          old.station !== now.station ||
          old.active !== now.active
        )
          await audit(tx, user, "menu.update", null, {
            ...now,
            from: { name: old.name, price: old.price, station: old.station, active: old.active },
          });
      }
    });
    return ok({});
  } catch {
    return fail(null, "Menü kaydedilemedi. Tekrar dene.");
  }
}

export async function saveBankAccounts(items: BankAccountDraft[]) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!Array.isArray(items) || items.length > 50)
    return fail(null, "IBAN listesi kaydedilemedi.");
  const clean = items.map((item, index) => ({
    id: item?.id === null ? null : item?.id,
    label: cleanName(item?.label),
    iban: typeof item?.iban === "string" ? item.iban.replace(/\s+/g, " ").trim() : "",
    active: item?.active === true,
    sortOrder: index + 1,
  }));
  for (const item of clean) {
    if (item.id !== null && !isUuid(item.id)) return fail(null, "Geçersiz IBAN kaydı.");
    if (item.label.length < 1 || item.label.length > 80)
      return fail(null, "Her IBAN için kimin hesabı olduğunu yaz.");
    if (item.iban.length < 5 || item.iban.length > 60)
      return fail(null, `"${item.label}" için IBAN'ı kontrol et.`);
  }
  try {
    await guestDb().begin(async (tx) => {
      for (const item of clean) {
        if (item.id === null)
          await tx`INSERT INTO guest_event.bank_accounts(label,iban,active,sort_order) VALUES(${item.label},${item.iban},${item.active},${item.sortOrder})`;
        else
          await tx`UPDATE guest_event.bank_accounts SET label=${item.label},iban=${item.iban},active=${item.active},sort_order=${item.sortOrder} WHERE id=${item.id}`;
      }
    });
    return ok({});
  } catch {
    return fail(null, "IBAN listesi kaydedilemedi. Tekrar dene.");
  }
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Six unambiguous characters shown as "ABC-DEF". */
const staffCode = () =>
  Array.from(
    { length: 6 },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join("");
const displayCode = (code: string | null) =>
  code ? code.slice(0, 3) + "-" + code.slice(3) : null;

/** Staff accounts with their readable codes. Admin only. */
export async function getStaffAccounts() {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  const rows =
    await guestDb()`SELECT id,name,role,active,login_code FROM guest_event.admins WHERE role<>'admin' ORDER BY active DESC,role,name`;
  return ok({
    staff: rows.map(
      (r): StaffAccount => ({
        id: r.id,
        name: r.name,
        role: r.role,
        active: r.active,
        code: displayCode(r.login_code),
      }),
    ),
  });
}

/** Creates a bar/pizza login with a short code that stays visible to admins. */
export async function createStaffAccount(name: string, role: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  const clean = cleanName(name);
  if (clean.length < 2 || clean.length > 60)
    return fail(null, "Personel adı 2–60 karakter olmalı.");
  if (!isStaffRole(role) || role === "admin")
    return fail(null, "Rol Bar veya Pizza olmalı.");
  const staffRole: StaffRole = role;
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = staffCode();
      const created = await guestDb().begin(async (tx) => {
        const rows =
          await tx`INSERT INTO guest_event.admins(name,code_hash,role,login_code) SELECT ${clean},${hash(code)},${staffRole},${code} WHERE NOT EXISTS (SELECT 1 FROM guest_event.admins WHERE login_code=${code}) ON CONFLICT (name) DO NOTHING RETURNING id`;
        if (!rows.length) return null;
        await audit(tx, user, "staff.create", null, {
          staffId: rows[0].id,
          name: clean,
          role: staffRole,
        });
        return String(rows[0].id);
      });
      if (created) return ok({ id: created, name: clean, code: displayCode(code) });
      const [taken] =
        await guestDb()`SELECT 1 FROM guest_event.admins WHERE name=${clean}`;
      if (taken)
        return fail(null, "Bu isimde bir hesap zaten var. Farklı bir ad kullan.");
    }
    return fail(null, "Kod üretilemedi. Tekrar dene.");
  } catch {
    return fail(null, "Personel hesabı oluşturulamadı.");
  }
}

/** Replaces a staff code; open sessions of that account are closed. */
export async function regenerateStaffCode(staffId: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!isUuid(staffId)) return fail(null, "Geçersiz hesap.");
  try {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = staffCode();
      const changed = await guestDb().begin(async (tx) => {
        const rows =
          await tx`UPDATE guest_event.admins SET login_code=${code},code_hash=${hash(code)} WHERE id=${staffId} AND role<>'admin' AND NOT EXISTS (SELECT 1 FROM guest_event.admins WHERE login_code=${code}) RETURNING id,name`;
        if (!rows.length) return false;
        await tx`DELETE FROM guest_event.admin_sessions WHERE admin_id=${staffId}`;
        await audit(tx, user, "staff.code", null, {
          staffId,
          name: rows[0].name,
        });
        return true;
      });
      if (changed) return ok({ code: displayCode(code) });
      const [exists] =
        await guestDb()`SELECT 1 FROM guest_event.admins WHERE id=${staffId} AND role<>'admin'`;
      if (!exists) throw new UserError("Bu hesap değiştirilemez.");
    }
    return fail(null, "Kod üretilemedi. Tekrar dene.");
  } catch (e) {
    return fail(e, "Kod yenilenemedi.");
  }
}

export async function setStaffActive(staffId: string, active: boolean) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!isUuid(staffId) || typeof active !== "boolean")
    return fail(null, "Geçersiz hesap.");
  if (staffId === user.id) return fail(null, "Kendi hesabını kapatamazsın.");
  try {
    await guestDb().begin(async (tx) => {
      const rows =
        await tx`UPDATE guest_event.admins SET active=${active} WHERE id=${staffId} AND role<>'admin' RETURNING id,name`;
      if (!rows.length) throw new UserError("Bu hesap değiştirilemez.");
      if (!active)
        await tx`DELETE FROM guest_event.admin_sessions WHERE admin_id=${staffId}`;
      await audit(tx, user, "staff.active", null, {
        staffId,
        name: rows[0].name,
        active,
      });
    });
    return ok({});
  } catch (e) {
    return fail(e, "Hesap güncellenemedi.");
  }
}

/** Fixes a staff member's name (typo, nickname). Admin only. */
export async function renameStaffAccount(staffId: string, name: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  const clean = cleanName(name);
  if (!isUuid(staffId)) return fail(null, "Geçersiz hesap.");
  if (clean.length < 2 || clean.length > 60)
    return fail(null, "Personel adı 2–60 karakter olmalı.");
  try {
    await guestDb().begin(async (tx) => {
      const [current] =
        await tx`SELECT name FROM guest_event.admins WHERE id=${staffId} AND role<>'admin' FOR UPDATE`;
      if (!current) throw new UserError("Bu hesap değiştirilemez.");
      const [taken] =
        await tx`SELECT 1 FROM guest_event.admins WHERE name=${clean} AND id<>${staffId}`;
      if (taken) throw new UserError("Bu isimde başka bir hesap var.");
      await tx`UPDATE guest_event.admins SET name=${clean} WHERE id=${staffId}`;
      await audit(tx, user, "staff.rename", null, {
        staffId,
        from: current.name,
        to: clean,
      });
    });
    return ok({});
  } catch (e) {
    return fail(e, "İsim değiştirilemedi.");
  }
}

/** Removes one entry of the activity log ("Hareket kaydı"). Admin only. */
export async function deleteAuditEntry(entryId: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (!isUuid(entryId)) return fail(null, "Geçersiz kayıt.");
  try {
    await guestDb()`DELETE FROM guest_event.tab_audit WHERE id=${entryId}`;
    return ok({});
  } catch {
    return fail(null, "Kayıt silinemedi.");
  }
}

/** Empties the whole activity log, e.g. after test runs. Admin only. */
export async function clearAudit() {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  try {
    const rows = await guestDb()`DELETE FROM guest_event.tab_audit RETURNING id`;
    return ok({ count: rows.length });
  } catch {
    return fail(null, "Hareket kaydı temizlenemedi.");
  }
}

/** The word the organiser types to confirm a reset, so it never happens by a stray tap. */
const RESET_WORD = "SIFIRLA";

/**
 * Starts over, e.g. after test runs: removes every line, payment and activity
 * log entry and puts all tabs back to unopened. Guests, menu, IBANs, discount
 * rules and staff logins stay. What was wiped is kept as one log entry.
 * Admin only, and only with the typed confirmation word.
 */
export async function resetTabData(confirmation: string) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  if (
    typeof confirmation !== "string" ||
    confirmation.trim().toLocaleUpperCase("tr") !== RESET_WORD
  )
    return fail(null, `Onaylamak için ${RESET_WORD} yaz.`);
  try {
    const wiped = await guestDb().begin(async (tx) => {
      const [lines] =
        await tx`SELECT count(*)::int AS n,COALESCE(sum(CASE WHEN complimentary THEN 0 ELSE price*qty-round(price*qty*discount_percent/100.0) END),0)::int AS total FROM guest_event.tab_lines`;
      const [payments] =
        await tx`SELECT count(*)::int AS n,COALESCE(sum(amount),0)::int AS total FROM guest_event.tab_payments`;
      await tx`DELETE FROM guest_event.tab_lines`;
      await tx`DELETE FROM guest_event.tab_payments`;
      await tx`UPDATE guest_event.tab_guests SET status='open',round=1,pending_method=NULL,pending_account_id=NULL`;
      await tx`DELETE FROM guest_event.tab_audit`;
      const record = {
        lines: lines.n,
        sales: lines.total,
        payments: payments.n,
        paid: payments.total,
      };
      await audit(tx, user, "data.reset", null, record);
      return record;
    });
    return ok(wiped);
  } catch {
    return fail(null, "Sıfırlanamadı. Tekrar dene.");
  }
}

/** Staff-related history: who created, renamed, renewed or closed which login. Admin only. */
export async function getStaffAudit() {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
  const rows =
    await guestDb()`SELECT id,action,record,actor_name,created_at FROM guest_event.tab_audit WHERE action LIKE 'staff.%' ORDER BY created_at DESC LIMIT 100`;
  return ok({
    entries: rows.map(
      (r): AuditEntry => ({
        id: r.id,
        action: r.action,
        guestName: null,
        record: r.record,
        actorName: r.actor_name,
        createdAt: r.created_at.toISOString(),
      }),
    ),
  });
}
