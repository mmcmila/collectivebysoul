import "server-only";
import { guestDb } from "@/lib/guest/db";

export type MenuSection = {
  title: string;
  items: { name: string; price: number }[];
};

/**
 * Layout of the printed HIDA Bar menu. Prices and availability come from the
 * Adisyon menu (`guest_event.menu_items`), matched by name, so the guest menu
 * always shows what the bar actually charges.
 */
const layout: { title: string; station: "bar" | "pizza"; names: string[] }[] = [
  {
    title: "İmzalar",
    station: "bar",
    names: ["Kuzu Kulağı", "Kızıl Olan", "Zenco Haze", "Porta-kal"],
  },
  {
    title: "Klasikler",
    station: "bar",
    names: ["Margarita", "Negroni", "Whiskey Sour", "Gin Soda / Tonic"],
  },
  // The last section of a station also receives items staff add later.
  {
    title: "Bardan",
    station: "bar",
    names: ["Heineken", "Shot", "Alkolsüz Kokteyl"],
  },
  { title: "Mutfaktan", station: "pizza", names: ["Pizza Dilim"] },
];

/** "Kuzu Kulagi" and "Kuzu Kulağı" are the same drink. */
const slug = (name: string) =>
  name
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function getMenuSections(): Promise<MenuSection[]> {
  const rows =
    await guestDb()`SELECT name,price,station FROM guest_event.menu_items WHERE active ORDER BY sort_order,name`;
  const bySlug = new Map(rows.map((row) => [slug(row.name), row]));
  const sections = layout.map((section) => ({
    title: section.title,
    items: section.names.flatMap((name) => {
      const row = bySlug.get(slug(name));
      if (!row) return [];
      bySlug.delete(slug(name));
      return [{ name, price: row.price as number }];
    }),
  }));
  for (const row of bySlug.values()) {
    const index = layout.findLastIndex((s) => s.station === row.station);
    sections[index]?.items.push({ name: row.name, price: row.price });
  }
  return sections.filter((section) => section.items.length > 0);
}
