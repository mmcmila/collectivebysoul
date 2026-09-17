export const stations = { bar: "Bar", pizza: "Pizza" } as const;
export type Station = keyof typeof stations;
export const isStation = (value: unknown): value is Station =>
  typeof value === "string" && Object.hasOwn(stations, value);

export const staffRoles = {
  admin: "Yönetici",
  bar: "Bar",
  pizza: "Pizza",
} as const;
export type StaffRole = keyof typeof staffRoles;
export const isStaffRole = (value: unknown): value is StaffRole =>
  typeof value === "string" && Object.hasOwn(staffRoles, value);

export const paymentMethods = { cash: "Nakit", iban: "IBAN" } as const;
export type PaymentMethod = keyof typeof paymentMethods;
export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === "string" && Object.hasOwn(paymentMethods, value);

export type TabStatus = "open" | "closed";

export type StaffUser = { id: string; name: string; role: StaffRole };

export type TabGuest = {
  id: string;
  name: string;
  status: TabStatus;
  createdAt: string;
};

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
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
};

export type TabPayment = {
  id: string;
  guestId: string;
  amount: number;
  method: PaymentMethod;
  createdBy: string | null;
  createdByName: string;
  createdAt: string;
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
  iban: string;
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
