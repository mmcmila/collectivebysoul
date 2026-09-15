export const FORTUNE_SLOT_MINUTES = 15;
export const FORTUNE_MAX_SLOTS = 14;

export const validFortuneTime = (value: unknown): value is string =>
  typeof value === "string" && /^(1[4-9]|2[0-3]):(00|15|30|45)$/.test(value);

const windows: Record<string, [string, string]> = {
  sound: ["15:00", "16:15"],
  scent: ["16:30", "18:00"],
  style: ["18:00", "19:00"],
};

export const isWorkshopId = (id: unknown): id is string =>
  typeof id === "string" && Object.hasOwn(windows, id);

export function conflictingWorkshop(selected: string[], slot: string) {
  if (!validFortuneTime(slot)) return undefined;
  return selected.find(
    (id) => windows[id] && slot >= windows[id][0] && slot < windows[id][1],
  );
}
