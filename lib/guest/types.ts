export type GuestPlan = {
  transport: string;
  origin: string;
  arrival: string;
  party: string;
  selected: string[];
  slot: string;
  /** Full workshops the guest wants a place in if one opens up. */
  waitlist: string[];
  /** Wants a Fortune Dome slot but none was free; the team assigns one. */
  fortuneWaitlist: boolean;
  allergy: string;
  allergyNote: string;
  diet: string;
  note: string;
  consent: boolean;
};

export type Availability = {
  id: string;
  capacity: number | null;
  remaining: number | null;
  owned?: boolean;
  enabled: boolean;
};

export type GuestData = {
  isDemo: boolean;
  plan: GuestPlan | null;
  availability: Availability[];
};

export const transports = [
  "Vapur / motor",
  "Özel deniz taksi",
  "İBB Deniz Taksi",
  "Henüz belli değil",
];

export const arrivals = [
  "14:00 öncesi",
  "14:00–14:30",
  "14:30–15:00",
  "15:00–15:30",
  "15:30–16:00",
  "16:00 sonrası",
];

export const diets = ["Özel bir tercihim yok", "Vejetaryen", "Vegan", "Diğer"];

/** Older saved plans predate the waitlist fields. */
export const normalizeGuestPlan = (
  plan: Partial<GuestPlan> & Record<string, unknown>,
): GuestPlan =>
  ({
    ...plan,
    waitlist: Array.isArray(plan.waitlist) ? plan.waitlist : [],
    fortuneWaitlist: plan.fortuneWaitlist === true,
  }) as GuestPlan;
