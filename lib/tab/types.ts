/** Station ids are fixed ("pizza" also covers hot dogs and other food); labels are what people see. */
export const stations = { bar: "Bar", pizza: "Yemek" } as const;
export type Station = keyof typeof stations;
export const isStation = (value: unknown): value is Station =>
  typeof value === "string" && Object.hasOwn(stations, value);

export const staffRoles = {
  admin: "Yönetici",
  bar: "Bar",
  pizza: "Yemek",
} as const;
export type StaffRole = keyof typeof staffRoles;
export const isStaffRole = (value: unknown): value is StaffRole =>
  typeof value === "string" && Object.hasOwn(staffRoles, value);

export const paymentMethods = { cash: "Nakit", iban: "IBAN", pos: "POS" } as const;
export type PaymentMethod = keyof typeof paymentMethods;
export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === "string" && Object.hasOwn(paymentMethods, value);

export type TabStatus = "open" | "closed";

export type StaffUser = { id: string; name: string; role: StaffRole };

export type TabGuest = {
  id: string;
  name: string;
  status: TabStatus;
  /** Participant type when the tab was opened from the management console. */
  category: "paid" | "team" | "guest" | null;
  /** Explicit per-person discount; null = follow the rules in settings. */
  discountOverride: number | null;
  /** Discount new lines will get right now (override, else matching rule, else 0). */
  discountPercent: number;
  /** Where the current discount comes from. */
  discountSource: "override" | "rule" | null;
  /** "iban": the guest will transfer later, tab stays open. */
  pendingMethod: "iban" | null;
  pendingAccountId: string | null;
  pendingAccountLabel: string | null;
  /** Current tab round; earlier rounds are closed history on the same profile. */
  round: number;
  createdAt: string;
};

export type DiscountRule = {
  id: string;
  kind: "category" | "guest";
  category: "paid" | "team" | "guest" | null;
  guestId: string | null;
  guestName: string | null;
  percent: number;
  label: string;
};

export type DiscountRuleDraft = {
  id: string | null;
  kind: "category" | "guest";
  category: "paid" | "team" | "guest" | null;
  guestId: string | null;
  percent: number;
  label: string;
};

/** Personal override wins, then a personal rule, then the participant-type rule. */
export function effectiveDiscount(
  guest: { id: string; category: string | null; discountOverride: number | null },
  rules: Pick<DiscountRule, "kind" | "category" | "guestId" | "percent" | "label">[],
): { percent: number; source: "override" | "rule" | null; label: string } {
  if (guest.discountOverride !== null)
    return { percent: guest.discountOverride, source: "override", label: "Kişiye özel" };
  const personal = rules.find((r) => r.kind === "guest" && r.guestId === guest.id);
  if (personal) return { percent: personal.percent, source: "rule", label: personal.label || "Kişiye özel kural" };
  const byType = rules.find((r) => r.kind === "category" && r.category === guest.category);
  if (byType) return { percent: byType.percent, source: "rule", label: byType.label || "Tür kuralı" };
  return { percent: 0, source: null, label: "" };
}

/** Prices and amounts are integer kuruş: 250 ₺ = 25000. */
export type MenuItem = {
  id: string;
  name: string;
  price: number;
  station: Station;
  active: boolean;
  sortOrder: number;
};

export type TabLine = {
  id: string;
  guestId: string;
  menuItemId: string | null;
  name: string;
  price: number;
  qty: number;
  station: Station;
  /** Given for free; counts as 0 ₺ but stays visible as "İkram". */
  complimentary: boolean;
  /** Discount in force when the line was added; later changes do not touch it. */
  discountPercent: number;
  round: number;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
};

export type TabPayment = {
  id: string;
  guestId: string;
  amount: number;
  method: PaymentMethod;
  /** Which IBAN the guest paid to; only for method "iban". */
  accountId: string | null;
  accountLabel: string | null;
  round: number;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
};

export type BankAccount = {
  id: string;
  /** Whose account it is, e.g. "Merve". */
  label: string;
  iban: string;
  active: boolean;
  sortOrder: number;
};

export type BankAccountDraft = {
  id: string | null;
  label: string;
  iban: string;
  active: boolean;
};

export type StaffAccount = {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
  /** Readable login code for bar/pizza accounts; null for password accounts. */
  code: string | null;
};

/** "ABC-DEF" → "ABCDEF": codes are compared without case, spaces or dashes. */
export const normalizeLoginCode = (value: string) =>
  value.toUpperCase().replace(/[\s-]/g, "");

export type AuditEntry = {
  id: string;
  action: "line.delete" | "payment.delete" | "guest.delete" | string;
  guestName: string | null;
  record: Record<string, unknown>;
  actorName: string;
  createdAt: string;
};

export type TabData = {
  guests: TabGuest[];
  menu: MenuItem[];
  lines: TabLine[];
  payments: TabPayment[];
  accounts: BankAccount[];
  discountRules: DiscountRule[];
  /** Latest deletions; only sent to admins. */
  audit: AuditEntry[];
  fetchedAt: string;
};

export type MenuDraftItem = {
  id: string | null;
  name: string;
  price: number;
  station: Station;
  active: boolean;
};
