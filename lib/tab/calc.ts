import type {
  AuditEntry,
  BankAccount,
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

export type Totals = {
  /** Sum of non-complimentary lines. */
  subtotal: number;
  /** Value of complimentary lines (not charged). */
  complimentary: number;
  /** Discount applied to the subtotal. */
  discount: number;
  /** subtotal − discount. */
  total: number;
  paid: number;
  due: number;
  count: number;
};

/** Discount of one line, from the percentage snapshotted when it was added. */
export const lineDiscount = (
  line: Pick<TabLine, "price" | "qty" | "complimentary" | "discountPercent">,
) =>
  line.complimentary
    ? 0
    : Math.round((line.price * line.qty * line.discountPercent) / 100);

/** Totals are derived from lines and payments; nothing is stored. */
export function guestTotals(
  lines: Pick<
    TabLine,
    "guestId" | "price" | "qty" | "complimentary" | "discountPercent" | "round"
  >[],
  payments: Pick<TabPayment, "guestId" | "amount" | "round">[],
  guestId: string,
  /** Limit to one round (the current one, or a past one for history). */
  round?: number,
): Totals {
  let subtotal = 0;
  let complimentary = 0;
  let discount = 0;
  let count = 0;
  const inRound = (r: number) => round === undefined || r === round;
  for (const line of lines)
    if (line.guestId === guestId && inRound(line.round)) {
      if (line.complimentary) complimentary += line.price * line.qty;
      else {
        subtotal += line.price * line.qty;
        discount += lineDiscount(line);
      }
      count += 1;
    }
  const total = subtotal - discount;
  let paid = 0;
  for (const payment of payments)
    if (payment.guestId === guestId && inRound(payment.round))
      paid += payment.amount;
  return {
    subtotal,
    complimentary,
    discount,
    total,
    paid,
    due: total - paid,
    count,
  };
}

/**
 * The one rule for open and closed: a tab that owes money is open; a tab with
 * activity and nothing owed is closed. Nobody closes a tab by hand, it follows
 * the balance after every order, payment and deletion.
 */
export const tabStatus = (
  round: Pick<Totals, "count" | "paid" | "due">,
): TabStatus => (hasActivity(round) && round.due <= 0 ? "closed" : "open");

/**
 * Rule: a new order on a fully paid round starts the next round, so the paid
 * orders move to the history at the bottom of the profile. An overpaid round
 * stays current so the credit is used by the new order.
 */
export const startsNewRound = (round: Pick<Totals, "count" | "paid" | "due">) =>
  round.count > 0 && round.paid > 0 && round.due === 0;

/**
 * Empty amount means "take the whole balance". Amounts are kuruş. More than
 * the balance is refused: it is almost always a typo and would leave the
 * summary with more money collected than sold.
 */
export function resolvePaymentAmount(
  requested: number | null,
  due: number,
): { amount: number } | { error: string } {
  if (requested !== null && (!Number.isInteger(requested) || requested <= 0))
    return { error: "Tutarı kontrol et." };
  if (due <= 0) return { error: "Bu hesapta kalan borç yok." };
  if (requested !== null && requested > due)
    return { error: `Tutar kalan borçtan (${formatMoney(due)}) fazla olamaz.` };
  return { amount: requested ?? due };
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

/**
 * Any staff member may delete a wrongly entered line or payment, whoever
 * entered it. Every deletion is written to the activity log, which only the
 * organiser can delete.
 */
export const canDeleteEntry = (user: { role: StaffRole }) =>
  user.role === "admin" || user.role === "bar" || user.role === "pizza";

/** "İkram" can be changed by the person who entered the line or an admin. */
export const canDeleteRecord = (
  user: { id: string; role: StaffRole },
  record: { createdBy: string | null },
) => user.role === "admin" || (!!record.createdBy && record.createdBy === user.id);

export const canAccessTabs = (role: StaffRole) =>
  role === "admin" || role === "bar" || role === "pizza";

/**
 * The day a sale belongs to, as YYYY-MM-DD in Istanbul time. A day runs from
 * 06:00 to 06:00 so sales after midnight still count for the event night.
 * (Istanbul is UTC+3 all year: 06:00 local = 03:00 UTC.)
 */
export const businessDay = (iso: string) =>
  new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

/** Limits lines and payments to one business day and/or one staff member. */
export function filterEntries<
  T extends { createdAt: string; createdByName: string },
>(entries: T[], filter: { day: string | null; staff: string | null }) {
  if (!filter.day && !filter.staff) return entries;
  return entries.filter(
    (e) =>
      (!filter.day || businessDay(e.createdAt) === filter.day) &&
      (!filter.staff || e.createdByName === filter.staff),
  );
}

export type Summary = {
  /** Net sales after complimentary lines and discounts. */
  total: number;
  /** Gross value of the lines before discounts and complimentary items. */
  gross: number;
  discount: number;
  complimentary: number;
  paid: number;
  /** What guests still owe: the sum of the open tabs, never negative. */
  due: number;
  byMethod: Record<PaymentMethod, number>;
  byStation: Record<Station, number>;
  /** Sorted by quantity sold, then amount. */
  byItem: {
    name: string;
    qty: number;
    complimentaryQty: number;
    amount: number;
    station: Station;
  }[];
  /** IBAN receipts per account, including inactive accounts that received money. */
  byAccount: { id: string; label: string; iban: string; amount: number; count: number }[];
  /** Guests who owe money (open tabs), highest balance first. */
  debtors: { id: string; name: string; due: number }[];
  /** Guests who paid everything (closed tabs) and what they paid in total. */
  settled: { id: string; name: string; paid: number }[];
  /**
   * Guests who paid more than their orders are worth, e.g. a product deleted
   * after it was paid. The difference may have to be given back.
   */
  overpaid: { id: string; name: string; amount: number }[];
};

export function summarize(
  data: Pick<TabData, "guests" | "lines" | "payments"> & {
    accounts?: BankAccount[];
  },
): Summary {
  const byMethod: Record<PaymentMethod, number> = { cash: 0, iban: 0, pos: 0 };
  const byStation: Record<Station, number> = { bar: 0, pizza: 0 };
  const items = new Map<
    string,
    {
      name: string;
      qty: number;
      complimentaryQty: number;
      amount: number;
      station: Station;
    }
  >();
  let gross = 0;
  let complimentary = 0;
  for (const line of data.lines) {
    const value = line.price * line.qty;
    gross += value;
    const amount = line.complimentary ? 0 : value;
    if (line.complimentary) complimentary += value;
    byStation[line.station] += amount;
    const item = items.get(line.name) ?? {
      name: line.name,
      qty: 0,
      complimentaryQty: 0,
      amount: 0,
      station: line.station,
    };
    item.qty += line.qty;
    if (line.complimentary) item.complimentaryQty += line.qty;
    item.amount += amount;
    items.set(line.name, item);
  }
  let discount = 0;
  for (const line of data.lines) discount += lineDiscount(line);
  const total = gross - complimentary - discount;
  let paid = 0;
  const accounts = new Map<
    string,
    { id: string; label: string; iban: string; amount: number; count: number }
  >();
  for (const account of data.accounts ?? [])
    accounts.set(account.id, {
      id: account.id,
      label: account.label,
      iban: account.iban,
      amount: 0,
      count: 0,
    });
  for (const payment of data.payments) {
    paid += payment.amount;
    byMethod[payment.method] += payment.amount;
    if (payment.method === "iban") {
      const key = payment.accountId ?? "unknown";
      const account = accounts.get(key) ?? {
        id: key,
        label: payment.accountLabel ?? "Hesap belirtilmemiş",
        iban: "",
        amount: 0,
        count: 0,
      };
      account.amount += payment.amount;
      account.count += 1;
      accounts.set(key, account);
    }
  }
  const debtors: Summary["debtors"] = [];
  const settled: Summary["settled"] = [];
  const overpaid: Summary["overpaid"] = [];
  for (const g of data.guests) {
    const overall = guestTotals(data.lines, data.payments, g.id);
    if (overall.due < 0)
      overpaid.push({ id: g.id, name: g.name, amount: -overall.due });
    const round = guestTotals(data.lines, data.payments, g.id, g.round);
    if (!hasActivity(round)) continue;
    if (tabStatus(round) === "open")
      debtors.push({ id: g.id, name: g.name, due: round.due });
    else
      settled.push({
        id: g.id,
        name: g.name,
        paid: guestTotals([], data.payments, g.id).paid,
      });
  }
  debtors.sort((a, b) => b.due - a.due || a.name.localeCompare(b.name, "tr"));
  settled.sort((a, b) => b.paid - a.paid || a.name.localeCompare(b.name, "tr"));
  overpaid.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "tr"));
  return {
    total,
    gross,
    discount,
    complimentary,
    paid,
    due: debtors.reduce((sum, g) => sum + g.due, 0),
    byMethod,
    byStation,
    byItem: [...items.values()].sort(
      (a, b) =>
        b.qty - a.qty ||
        b.amount - a.amount ||
        a.name.localeCompare(b.name, "tr"),
    ),
    byAccount: [...accounts.values()].sort((a, b) => b.amount - a.amount),
    debtors,
    settled,
    overpaid,
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
      "iban_hesabi",
      "kullanici",
      "zaman",
    ],
  ];
  const entries: { at: string; row: (string | number)[] }[] = [];
  for (const line of data.lines)
    entries.push({
      at: line.createdAt,
      row: [
        line.complimentary ? "ikram" : "satis",
        guestName.get(line.guestId) ?? "",
        line.name,
        line.qty,
        csvMoney(line.price),
        csvMoney(line.complimentary ? 0 : line.price * line.qty),
        line.station,
        "",
        line.createdByName,
        csvTime(line.createdAt),
      ],
    });
  for (const g of data.guests) {
    const t = guestTotals(data.lines, [], g.id);
    if (t.discount > 0)
      entries.push({
        at: g.createdAt,
        row: [
          "indirim",
          g.name,
          "indirim",
          "",
          "",
          csvMoney(-t.discount),
          "",
          "",
          "",
          csvTime(g.createdAt),
        ],
      });
  }
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
        payment.accountLabel ?? "",
        payment.createdByName,
        csvTime(payment.createdAt),
      ],
    });
  entries.sort((a, b) => a.at.localeCompare(b.at));
  for (const entry of entries) rows.push(entry.row);
  return rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export type GuestRow = TabGuest &
  Totals & {
    active: boolean;
    /** Owes money, paid everything, or nothing entered yet. */
    state: TabStatus | "unopened";
    /** Everything this guest has paid, earlier rounds included. */
    paidTotal: number;
  };

/** A tab counts as opened once something was entered in its current round. */
export const hasActivity = (t: Pick<Totals, "count" | "paid">) =>
  t.count > 0 || t.paid > 0;

/**
 * "Açık": guests who owe money. "Kapalı": guests who paid everything.
 * "Hepsi": everyone, including guests whose tab was never opened. A search
 * always looks through everyone so a new tab can be opened from the list.
 */
export function guestRows(
  data: Pick<TabData, "guests" | "lines" | "payments">,
  filter: "open" | "all" | "closed",
  query: string,
): GuestRow[] {
  const rows = data.guests.map((g) => {
    const totals = guestTotals(data.lines, data.payments, g.id, g.round);
    const active = hasActivity(totals);
    return {
      ...g,
      ...totals,
      active,
      state: active ? tabStatus(totals) : ("unopened" as const),
      paidTotal: guestTotals([], data.payments, g.id).paid,
    };
  });
  const searching = query.trim().length > 0;
  return sortByName(
    rows.filter((g) => {
      if (searching) return matchesSearch(g.name, query);
      if (filter === "open") return g.state === "open";
      if (filter === "closed") return g.state === "closed";
      return true;
    }),
  );
}

/** Closed rounds before the current one, newest first. */
export function pastRounds(
  data: Pick<TabData, "lines" | "payments">,
  guest: Pick<TabGuest, "id" | "round">,
) {
  const rounds: number[] = [];
  for (let r = guest.round - 1; r >= 1; r--) rounds.push(r);
  return rounds
    .map((round) => {
      const lines = data.lines.filter(
        (l) => l.guestId === guest.id && l.round === round,
      );
      const payments = data.payments.filter(
        (p) => p.guestId === guest.id && p.round === round,
      );
      const times = [...lines, ...payments].map((x) => x.createdAt).sort();
      return {
        round,
        lines,
        payments,
        totals: guestTotals(data.lines, data.payments, guest.id, round),
        from: times[0] ?? null,
        to: times[times.length - 1] ?? null,
      };
    })
    .filter((r) => r.lines.length || r.payments.length);
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
  const str = (key: string) => (typeof r[key] === "string" ? (r[key] as string) : "");
  if (entry.action === "staff.create")
    return `Personel girişi oluşturuldu: ${str("name")} (${str("role") === "pizza" ? "Yemek" : "Bar"})`;
  if (entry.action === "staff.rename")
    return `Personel adı değişti: ${str("from")} → ${str("to")}`;
  if (entry.action === "staff.code")
    return `Yeni giriş kodu: ${str("name")}`;
  if (entry.action === "staff.active")
    return `Personel girişi ${r.active ? "açıldı" : "kapatıldı"}: ${str("name")}`;
  if (entry.action === "discount.rules") {
    const n = Array.isArray(r.rules) ? r.rules.length : 0;
    return `İndirim kuralları güncellendi (${n} kural)`;
  }
  if (entry.action === "line.complimentary")
    return `${guest}: ${String(r.name ?? "kalem")} ${r.complimentary ? "ikram yapıldı" : "ikramdan çıkarıldı"}`;
  if (entry.action === "guest.discount")
    return `${guest}: indirim %${num("discountPercent")}`;
  if (entry.action === "line.delete")
    return `${guest}: ürün silindi · ${String(r.name ?? "kalem")} ${num("qty") > 1 ? `×${num("qty")} ` : ""}· ${formatMoney(num("price") * (num("qty") || 1))}`;
  if (entry.action === "payment.delete")
    return `${guest}: ödeme silindi · ${r.method === "iban" ? "IBAN" : r.method === "pos" ? "POS" : "Nakit"} · ${formatMoney(num("amount"))}`;
  if (entry.action === "menu.create")
    return `Menüye eklendi: ${str("name")} · ${formatMoney(num("price"))} (${str("station") === "pizza" ? "Yemek" : "Bar"})`;
  if (entry.action === "data.reset")
    return `Adisyon sıfırlandı: ${num("lines")} ürün (${formatMoney(num("sales"))}) ve ${num("payments")} ödeme (${formatMoney(num("paid"))}) silindi`;
  if (entry.action === "menu.update") {
    const from = (typeof r.from === "object" && r.from ? r.from : {}) as Record<string, unknown>;
    const changes: string[] = [];
    if (typeof from.price === "number" && from.price !== r.price)
      changes.push(`fiyat ${formatMoney(from.price)} → ${formatMoney(num("price"))}`);
    if (typeof from.active === "boolean" && from.active !== r.active)
      changes.push(r.active ? "menüde tekrar açıldı" : "menüde gizlendi");
    if (typeof from.name === "string" && from.name !== r.name)
      changes.push(`eski adı ${from.name}`);
    if (typeof from.station === "string" && from.station !== r.station)
      changes.push(`bölüm ${str("station") === "pizza" ? "Yemek" : "Bar"}`);
    return `Menü: ${str("name")} · ${changes.join(", ") || "güncellendi"}`;
  }
  if (entry.action === "menu.delete")
    return `Menüden silindi: ${str("name")} · ${formatMoney(num("price"))}`;
  if (entry.action === "account.delete")
    return `IBAN silindi: ${str("label")}`;
  if (entry.action === "guest.delete") {
    const lines = Array.isArray(r.lines) ? r.lines.length : 0;
    const payments = Array.isArray(r.payments) ? r.payments.length : 0;
    return `${guest}: misafir silindi (${lines} kalem, ${payments} ödeme)`;
  }
  return `${guest}: ${entry.action}`;
}

/** Headline for the list: how many guests owe money, how many paid everything. */
export function openSummary(
  data: Pick<TabData, "guests" | "lines" | "payments">,
) {
  let open = 0;
  let closed = 0;
  let due = 0;
  for (const g of data.guests) {
    const t = guestTotals(data.lines, data.payments, g.id, g.round);
    if (!hasActivity(t)) continue;
    if (tabStatus(t) === "closed") closed += 1;
    else {
      open += 1;
      due += t.due;
    }
  }
  return { open, closed, due };
}

/** Message a guest can settle later: name, balance and the IBAN text. */
export const balanceMessage = (name: string, due: number, iban: string) =>
  `${name} · Kalan ${formatMoney(due)}\n${iban}`.trim();
