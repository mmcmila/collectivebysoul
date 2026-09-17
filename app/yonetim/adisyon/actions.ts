"use server";
import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import type postgres from "postgres";

import { currentAdmin, currentOrganiser } from "@/lib/guest/admin-session";
import { guestDb, UserError } from "@/lib/guest/db";
import { hash } from "@/lib/guest/session";
import {
  canDeleteRecord,
  guestTotals,
  resolvePaymentAmount,
  statusAfterPayment,
  statusAfterPaymentRemoved,
} from "@/lib/tab/calc";
import { loadTabData } from "@/lib/tab/data";
import {
  effectiveDiscount,
  isPaymentMethod,
  isStaffRole,
  isStation,
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
    await tx`SELECT g.id,g.name,g.status,g.discount_percent,t.category FROM guest_event.tab_guests g LEFT JOIN guest_event.tickets t ON t.id=g.ticket_id WHERE g.id=${guestId} FOR UPDATE OF g`;
  if (!guest) throw new UserError("Bu misafir silinmiş. Listeyi yenile.");
  return guest as {
    id: string;
    name: string;
    status: TabStatus;
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

async function balance(tx: Tx, guestId: string) {
  const lines = await tx<
    { guestId: string; price: number; qty: number; complimentary: boolean; discountPercent: number }[]
  >`SELECT guest_id AS "guestId",price,qty,complimentary,discount_percent AS "discountPercent" FROM guest_event.tab_lines WHERE guest_id=${guestId}`;
  const payments = await tx<{ guestId: string; amount: number }[]>`SELECT guest_id AS "guestId",amount FROM guest_event.tab_payments WHERE guest_id=${guestId}`;
  return guestTotals(lines, payments, guestId);
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
      const [line] =
        await tx`INSERT INTO guest_event.tab_lines(guest_id,menu_item_id,name,price,qty,station,discount_percent,created_by) VALUES(${guestId},${item.id},${item.name},${item.price},1,${item.station},${discountPercent},${user.id}) RETURNING id,created_at`;
      let status: TabStatus = guest.status;
      if (status === "closed") {
        status = "open";
        await tx`UPDATE guest_event.tab_guests SET status='open' WHERE id=${guestId}`;
      }
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
        createdBy: user.id,
        createdByName: user.name,
        createdAt: line.created_at.toISOString(),
      };
      return { line: created, status };
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
        await tx`SELECT id,guest_id,menu_item_id,name,price,qty,station,complimentary,created_by,created_at FROM guest_event.tab_lines WHERE id=${lineId} FOR UPDATE`;
      if (!line) throw new UserError("Bu kalem zaten silinmiş.");
      if (!canDeleteRecord(user, { createdBy: line.created_by }))
        throw new UserError(
          "Sadece kalemi giren kişi veya yönetici silebilir.",
        );
      await audit(tx, user, "line.delete", line.guest_id, line);
      await tx`DELETE FROM guest_event.tab_lines WHERE id=${lineId}`;
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
  close = false,
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
      await lockGuest(tx, guestId);
      let account: { id: string; label: string } | null = null;
      if (method === "iban") {
        const [row] =
          await tx`SELECT id,label FROM guest_event.bank_accounts WHERE id=${accountId as string} AND active`;
        if (!row) throw new UserError("Bu IBAN artık kullanımda değil. Ayarları yenile.");
        account = { id: row.id, label: row.label };
      }
      const { due } = await balance(tx, guestId);
      const resolved = resolvePaymentAmount(amount, due);
      if ("error" in resolved) throw new UserError(resolved.error);
      if (close === true && due - resolved.amount > 0)
        throw new UserError(
          "Bu tutar kalanı kapatmıyor. Kalanın tamamını al veya hesabı açık bırak.",
        );
      const [payment] =
        await tx`INSERT INTO guest_event.tab_payments(guest_id,amount,method,bank_account_id,created_by) VALUES(${guestId},${resolved.amount},${method},${account?.id ?? null},${user.id}) RETURNING id,created_at`;
      const status = statusAfterPayment(due - resolved.amount, close === true);
      // A recorded payment ends any "will pay by IBAN later" state.
      await tx`UPDATE guest_event.tab_guests SET status=${status},pending_method=NULL,pending_account_id=NULL WHERE id=${guestId}`;
      const created: TabPayment = {
        id: payment.id,
        guestId,
        amount: resolved.amount,
        method,
        accountId: account?.id ?? null,
        accountLabel: account?.label ?? null,
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
        await tx`SELECT id,guest_id,amount,method,bank_account_id,created_by,created_at FROM guest_event.tab_payments WHERE id=${paymentId} FOR UPDATE`;
      if (!payment) throw new UserError("Bu ödeme zaten silinmiş.");
      if (!canDeleteRecord(user, { createdBy: payment.created_by }))
        throw new UserError(
          "Sadece ödemeyi alan kişi veya yönetici silebilir.",
        );
      const guest = await lockGuest(tx, payment.guest_id);
      await audit(tx, user, "payment.delete", payment.guest_id, payment);
      await tx`DELETE FROM guest_event.tab_payments WHERE id=${paymentId}`;
      const { due } = await balance(tx, payment.guest_id);
      const status = statusAfterPaymentRemoved(guest.status, due);
      if (status !== guest.status)
        await tx`UPDATE guest_event.tab_guests SET status=${status} WHERE id=${payment.guest_id}`;
    });
    return ok({});
  } catch (e) {
    return fail(e, "Ödeme silinemedi.");
  }
}

export async function closeTabGuest(guestId: string) {
  const user = await currentAdmin();
  if (!user) return fail(null, SESSION_ERROR);
  if (!isUuid(guestId)) return fail(null, "Geçersiz misafir.");
  try {
    await guestDb().begin(async (tx) => {
      await lockGuest(tx, guestId);
      const { due } = await balance(tx, guestId);
      if (due > 0)
        throw new UserError("Kalan borç varken hesap kapatılamaz. Önce ödeme al.");
      await tx`UPDATE guest_event.tab_guests SET status='closed',pending_method=NULL,pending_account_id=NULL WHERE id=${guestId}`;
    });
    return ok({});
  } catch (e) {
    return fail(e, "Hesap kapatılamadı.");
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
        await tx`SELECT id,guest_id,name,price,qty,created_by FROM guest_event.tab_lines WHERE id=${lineId} FOR UPDATE`;
      if (!line) throw new UserError("Bu kalem silinmiş.");
      if (!canDeleteRecord(user, { createdBy: line.created_by }))
        throw new UserError("Sadece kalemi giren kişi veya yönetici ikram yapabilir.");
      await tx`UPDATE guest_event.tab_lines SET complimentary=${complimentary} WHERE id=${lineId}`;
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
    await guestDb()`DELETE FROM guest_event.menu_items WHERE id=${itemId}`;
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
      await tx`DELETE FROM guest_event.bank_accounts WHERE id=${accountId}`;
    });
    return ok({});
  } catch (e) {
    return fail(e, "IBAN silinemedi.");
  }
}

export async function saveMenu(items: MenuDraftItem[]) {
  const user = await currentOrganiser();
  if (!user) return fail(null, ADMIN_ERROR);
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
      for (const item of clean) {
        if (item.id === null)
          await tx`INSERT INTO guest_event.menu_items(name,price,station,active,sort_order) VALUES(${item.name},${item.price as number},${item.station as string},${item.active},${item.sortOrder})`;
        else
          await tx`UPDATE guest_event.menu_items SET name=${item.name},price=${item.price as number},station=${item.station as string},active=${item.active},sort_order=${item.sortOrder} WHERE id=${item.id}`;
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
      const rows =
        await guestDb()`INSERT INTO guest_event.admins(name,code_hash,role,login_code) SELECT ${clean},${hash(code)},${staffRole},${code} WHERE NOT EXISTS (SELECT 1 FROM guest_event.admins WHERE login_code=${code}) ON CONFLICT (name) DO NOTHING RETURNING id`;
      if (rows.length)
        return ok({ id: String(rows[0].id), name: clean, code: displayCode(code) });
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
          await tx`UPDATE guest_event.admins SET login_code=${code},code_hash=${hash(code)} WHERE id=${staffId} AND role<>'admin' AND NOT EXISTS (SELECT 1 FROM guest_event.admins WHERE login_code=${code}) RETURNING id`;
        if (!rows.length) return false;
        await tx`DELETE FROM guest_event.admin_sessions WHERE admin_id=${staffId}`;
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
        await tx`UPDATE guest_event.admins SET active=${active} WHERE id=${staffId} AND role<>'admin' RETURNING id`;
      if (!rows.length) throw new UserError("Bu hesap değiştirilemez.");
      if (!active)
        await tx`DELETE FROM guest_event.admin_sessions WHERE admin_id=${staffId}`;
    });
    return ok({});
  } catch (e) {
    return fail(e, "Hesap güncellenemedi.");
  }
}
