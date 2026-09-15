import type { GuestPlan } from "./types";

export const guestCategories = {
  paid: "Biletli",
  team: "Ekipten",
  guest: "Misafir",
} as const;

export type GuestCategory = keyof typeof guestCategories;

export const isGuestCategory = (value: unknown): value is GuestCategory =>
  typeof value === "string" && Object.hasOwn(guestCategories, value);

export type AdminGuest = {
  id: string;
  name: string;
  category: GuestCategory;
  active: boolean;
  isDemo: boolean;
  updatedAt: string | null;
  plan: GuestPlan | null;
};

export type AdminWorkshop = {
  id: string;
  capacity: number | null;
  booked: number;
  enabled: boolean;
  guests: { id: string; name: string }[];
};

export type AdminData = {
  guests: AdminGuest[];
  workshops: AdminWorkshop[];
  fetchedAt: string;
};
