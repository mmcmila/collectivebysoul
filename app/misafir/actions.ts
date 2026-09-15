"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { guestDb, UserError } from "@/lib/guest/db";
import {
  conflictingWorkshop,
  isWorkshopId,
  validFortuneTime,
} from "@/lib/guest/fortune";
import { persistGuestPlan } from "@/lib/guest/reservations";
import {
  clientKey,
  consumeLoginAttempt,
  cookieName,
  currentGuest,
  hash,
  newSessionToken,
  readSessionToken,
  setSessionCookie,
} from "@/lib/guest/session";
import {
  arrivals,
  diets,
  transports,
  type Availability,
  type GuestPlan,
} from "@/lib/guest/types";

export async function loginGuest(code: string) {
  if (typeof code !== "string" || code.length > 100)
    return { error: "Kodunu kontrol edip yeniden dene." };
  try {
    if (!(await consumeLoginAttempt(await clientKey(), 10)))
      return {
        error: "Çok fazla deneme yapıldı. 15 dakika sonra tekrar dene.",
      };
    const sql = guestDb();
    const normalized = code.toUpperCase().replace(/[\s-]/g, "");
    const [ticket] =
      await sql`SELECT id FROM guest_event.tickets WHERE code_hash=${hash(normalized)} AND active`;
    if (!ticket)
      return {
        error:
          "Kod bulunamadı veya kullanıma kapalı. Sana iletilen kişisel kodu kontrol et.",
      };
    const token = newSessionToken();
    await sql`INSERT INTO guest_event.sessions (token_hash,ticket_id,expires_at) VALUES (${hash(token)},${ticket.id},now()+interval '7 days')`;
    await setSessionCookie(cookieName, token, "/", 7 * 86400);
    return { ok: true };
  } catch {
    return { error: "Şu an bağlantı kurulamıyor. Biraz sonra tekrar dene." };
  }
}

export async function logoutGuest() {
  const token = await readSessionToken(cookieName);
  if (token)
    await guestDb()`DELETE FROM guest_event.sessions WHERE token_hash=${hash(token)}`;
  (await cookies()).delete(cookieName);
  redirect("/misafir");
}

export async function getAvailability(): Promise<Availability[]> {
  const guest = await currentGuest();
  if (!guest) redirect("/misafir");
  const rows =
    await guestDb()`SELECT w.id,w.capacity,w.enabled,CASE WHEN w.capacity IS NULL THEN NULL ELSE greatest(0,w.capacity-count(t.id)::int) END AS remaining, bool_or(t.id=${guest.id}) AS owned FROM guest_event.workshops w LEFT JOIN guest_event.reservations r ON r.workshop_id=w.id LEFT JOIN guest_event.tickets t ON t.id=r.ticket_id AND t.active AND NOT t.is_demo GROUP BY w.id ORDER BY w.id`;
  return rows as unknown as Availability[];
}

export async function saveGuestPlan(input: GuestPlan) {
  if (!input || typeof input !== "object")
    return { error: "Bilgilerini kontrol et." };
  const strings = [
    "transport",
    "origin",
    "arrival",
    "party",
    "slot",
    "allergy",
    "allergyNote",
    "diet",
    "note",
  ] as const;
  if (
    strings.some(
      (k) => typeof input[k] !== "string" || input[k].length > 1000,
    ) ||
    !Array.isArray(input.selected) ||
    input.selected.length > 3 ||
    !input.selected.every(isWorkshopId) ||
    new Set(input.selected).size !== input.selected.length
  )
    return { error: "Bilgilerini kontrol et." };
  if (
    !transports.includes(input.transport) ||
    !(input.arrival === "" || arrivals.includes(input.arrival)) ||
    !/^(10|[1-9])$/.test(input.party) ||
    !["Yok", "Var"].includes(input.allergy) ||
    (input.allergy === "Var" && !input.allergyNote.trim()) ||
    !diets.includes(input.diet) ||
    input.consent !== true
  )
    return { error: "Lütfen gerekli bilgileri ve paylaşım onayını tamamla." };
  if (input.slot && !validFortuneTime(input.slot))
    return { error: "Geçerli bir Fortune Dome saati seç." };
  if (input.slot && conflictingWorkshop(input.selected, input.slot))
    return { error: "Seçtiğin atölye ve Fortune Dome saatlerin çakışıyor." };
  const data: GuestPlan = {
    transport: input.transport,
    origin: input.origin.trim(),
    arrival: input.arrival,
    party: input.party,
    selected: input.selected,
    slot: input.slot,
    allergy: input.allergy,
    allergyNote: input.allergy === "Var" ? input.allergyNote.trim() : "",
    diet: input.diet,
    note: input.note.trim(),
    consent: true,
  };
  try {
    const guest = await currentGuest();
    if (!guest)
      return {
        error: "Oturumun sona erdi. Sayfayı yenileyip tekrar giriş yap.",
      };
    await persistGuestPlan({ id: guest.id, is_demo: guest.is_demo }, data);
    return { ok: true };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    return {
      error:
        "Plan kaydedilemedi. Seçimlerin bu ekranda duruyor; tekrar deneyebilirsin.",
    };
  }
}
