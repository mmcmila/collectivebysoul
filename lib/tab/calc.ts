import type {
  AuditEntry,
  MenuItem,
  PaymentMethod,
  StaffRole,
  Station,
  TabData,
  TabGuest,
  TabLine,
  TabPayment,
  TabStatus,
} from "./types";

export type Totals = { total: number; paid: number; due: number; count: number };

/** Totals are derived from lines and payments; nothing is stored. */
export function guestTotals(
  lines: Pick<TabLine, "guestId" | "price" | "qty">[],
  payments: Pick<TabPayment, "guestId" | "amount">[],
  guestId: string,
): Totals {
  let total = 0;
  let count = 0;
  for (const line of lines)
    if (line.guestId === guestId) {
      total += line.price * line.qty;
      count += 1;
    }
  let paid = 0;
  for (const payment of payments)
    if (payment.guestId === guestId) paid += payment.amount;
  return { total, paid, due: total - paid, count };
}

/** Rule: a payment that settles the balance closes the tab. */
export const statusAfterPayment = (due: number): TabStatus =>
  due <= 0 ? "closed" : "open";

/** Rule: adding a line to a closed tab reopens it. */
export const statusAfterLine = (): TabStatus => "open";

/** Rule: removing a payment that leaves a balance reopens a closed tab. */
export const statusAfterPaymentRemoved = (
  status: TabStatus,
  due: number,
): TabStatus => (due > 0 ? "open" : status);

/** Rule: "Hesabı kapat" is only allowed when nothing is owed. */
export const canClose = (status: TabStatus, due: number) =>
  status === "open" && due <= 0;

/** Empty amount means "take the whole balance". Amounts are kuruş. */
export function resolvePaymentAmount(
  requested: number | null,
  due: number,
): { amount: number } | { error: string } {
  if (requested !== null && (!Number.isInteger(requested) || requested <= 0))
    return { error: "Tutarı kontrol et." };
  const amount = requested ?? due;
  if (amount <= 0) return { error: "Bu hesapta kalan borç yok." };
  return { amount };
}

/** "12,50", "12.50", "1.250" and "1250" → kuruş. Empty → null. */
export function parseAmount(input: string): number | null | undefined {
  const raw = input.trim();
  if (!raw) return null;
  let normalized = raw.replace(/\s|₺/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(normalized))
    normalized = normalized.replace(/\./g, "");
  normalized = normalized.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  return Math.round(Number(normalized) * 100);
}

const wholeFormat = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 0,
});
const fractionFormat = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 125000 → "1.250 ₺", 1250 → "12,50 ₺". */
export function formatMoney(kurus: number) {
  const rounded = Math.round(kurus);
  const format = rounded % 100 === 0 ? wholeFormat : fractionFormat;
  return format.format(rounded / 100) + " ₺";
}

/** Lira value for form inputs: 125000 → "1250", 1250 → "12,50". */
export const formatLiraInput = (kurus: number) =>
  Number.isInteger(kurus / 100)
    ? String(kurus / 100)
    : (kurus / 100).toFixed(2).replace(".", ",");

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
});
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export const formatDateTime = (iso: string) =>
  dateTimeFormat.format(new Date(iso));

/** Case- and diacritic-insensitive matching for Turkish names. */
export const searchKey = (value: string) =>
  value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const matchesSearch = (name: string, query: string) =>
  !query.trim() || searchKey(name).includes(searchKey(query.trim()));

export const sortByName = <T extends { name: string }>(items: T[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, "tr"));

export const stationForRole = (role: StaffRole): Station =>
  role === "pizza" ? "pizza" : "bar";

/** Lines and payments can be removed by the person who entered them or an admin. */
export const canDeleteRecord = (
  user: { id: string; role: StaffRole },
  record: { createdBy: string | null },
) => user.role === "admin" || (!!record.createdBy && record.createdBy === user.id);

export const canAccessTabs = (role: StaffRole) =>
  role === "admin" || role === "bar" || role === "pizza";

export type Summary = {
  total: number;
  paid: number;
  due: number;
  byMethod: Record<PaymentMethod, number>;
  byStation: Record<Station, number>;
  byItem: { name: string; qty: number; amount: number }[];
  debtors: { id: string; name: string; due: number }[];
};

export function summarize(
  data: Pick<TabData, "guests" | "lines" | "payments">,
): Summary {
  const byMethod: Record<PaymentMethod, number> = { cash: 0, iban: 0 };
  const byStation: Record<Station, number> = { bar: 0, pizza: 0 };
  const items = new Map<string, { name: string; qty: number; amount: number }>();
  let total = 0;
  for (const line of data.lines) {
    const amount = line.price * line.qty;
    total += amount;
    byStation[line.station] += amount;
    const item = items.get(line.name) ?? { name: line.name, qty: 0, amount: 0 };
    item.qty += line.qty;
    item.amount += amount;
    items.set(line.name, item);
  }
  let paid = 0;
  for (const payment of data.payments) {
    paid += payment.amount;
    byMethod[payment.method] += payment.amount;
  }
  const debtors = data.guests
    .map((g) => ({
      id: g.id,
      name: g.name,
      due: guestTotals(data.lines, data.payments, g.id).due,
    }))
    .filter((g) => g.due > 0)
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name, "tr"));
  return {
    total,
    paid,
    due: total - paid,
    byMethod,
    byStation,
    byItem: [...items.values()].sort(
      (a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "tr"),
    ),
    debtors,
  };
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[;"\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};
const csvMoney = (kurus: number) => (kurus / 100).toFixed(2).replace(".", ",");
const csvTime = (iso: string) => {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
};

/** Semicolon-separated so Turkish Excel opens it directly; amounts use a decimal comma. */
export function buildCsv(
  data: Pick<TabData, "guests" | "lines" | "payments">,
): string {
  const guestName = new Map(data.guests.map((g) => [g.id, g.name]));
  const rows: (string | number)[][] = [
    [
      "tip",
      "misafir",
      "urun",
      "adet",
      "fiyat",
      "tutar",
      "istasyon_veya_yontem",
      "kullanici",
      "zaman",
    ],
  ];
  const entries: { at: string; row: (string | number)[] }[] = [];
  for (const line of data.lines)
    entries.push({
      at: line.createdAt,
      row: [
        "satis",
        guestName.get(line.guestId) ?? "",
        line.name,
        line.qty,
        csvMoney(line.price),
        csvMoney(line.price * line.qty),
        line.station,
        line.createdByName,
        csvTime(line.createdAt),
      ],
    });
  for (const payment of data.payments)
    entries.push({
      at: payment.createdAt,
      row: [
        "odeme",
        guestName.get(payment.guestId) ?? "",
        "",
        "",
        "",
        csvMoney(payment.amount),
        payment.method,
        payment.createdByName,
        csvTime(payment.createdAt),
      ],
    });
  entries.sort((a, b) => a.at.localeCompare(b.at));
  for (const entry of entries) rows.push(entry.row);
  return rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export type GuestRow = TabGuest & Totals;

export function guestRows(
  data: Pick<TabData, "guests" | "lines" | "payments">,
  filter: "open" | "all" | "closed",
  query: string,
): GuestRow[] {
  return sortByName(
    data.guests
      .filter(
        (g) =>
          (filter === "all" || g.status === filter) &&
          matchesSearch(g.name, query),
      )
      .map((g) => ({ ...g, ...guestTotals(data.lines, data.payments, g.id) })),
  );
}

export const visibleMenu = (
  menu: MenuItem[],
  station: Station,
  all: boolean,
) =>
  menu
    .filter((m) => m.active && (all || m.station === station))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"));

/** Short human-readable line for the deletion log. */
export function describeAudit(entry: Pick<AuditEntry, "action" | "record" | "guestName">) {
  const r = entry.record;
  const num = (key: string) => (typeof r[key] === "number" ? (r[key] as number) : 0);
  const guest = entry.guestName ?? "Silinmiş misafir";
  if (entry.action === "line.delete")
    return `${guest}: ${String(r.name ?? "kalem")} ${num("qty") > 1 ? `×${num("qty")} ` : ""}· ${formatMoney(num("price") * (num("qty") || 1))}`;
  if (entry.action === "payment.delete")
    return `${guest}: ${r.method === "iban" ? "IBAN" : "Nakit"} ödemesi · ${formatMoney(num("amount"))}`;
  if (entry.action === "guest.delete") {
    const lines = Array.isArray(r.lines) ? r.lines.length : 0;
    const payments = Array.isArray(r.payments) ? r.payments.length : 0;
    return `${guest}: misafir silindi (${lines} kalem, ${payments} ödeme)`;
  }
  return `${guest}: ${entry.action}`;
}

/** Headline for the list: how many tabs are open and how much is still owed. */
export function openSummary(
  data: Pick<TabData, "guests" | "lines" | "payments">,
) {
  const open = data.guests.filter((g) => g.status === "open");
  let due = 0;
  for (const g of open) due += Math.max(0, guestTotals(data.lines, data.payments, g.id).due);
  return { open: open.length, due };
}

/** Message a guest can settle later: name, balance and the IBAN text. */
export const balanceMessage = (name: string, due: number, iban: string) =>
  `${name} · Kalan ${formatMoney(due)}\n${iban}`.trim();
