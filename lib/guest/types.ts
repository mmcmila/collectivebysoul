export type GuestPlan = {
 transport: string; origin: string; arrival: string; party: string;
 selected: string[]; slot: string; allergy: string; allergyNote: string;
 diet: string; note: string; consent: boolean;
};
export type Availability = { id: string; capacity: number | null; remaining: number | null; owned?: boolean; enabled: boolean };
export type GuestData = { name: string; isDemo: boolean; plan: GuestPlan | null; availability: Availability[] };
