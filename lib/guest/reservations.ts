import { UserError, withEventLock } from "./db";
import { conflictingWorkshop } from "./fortune";
import type { GuestPlan } from "./types";

export async function persistGuestPlan(
  guest: { id: string; is_demo: boolean },
  data: GuestPlan,
) {
  await withEventLock(async (sql) => {
    const [valid] =
      await sql`SELECT id FROM guest_event.tickets WHERE id=${guest.id} AND active FOR UPDATE`;
    if (!valid) throw new UserError("Oturumun kullanıma kapalı.");
    if (
      data.slot &&
      conflictingWorkshop([...data.selected, ...data.waitlist], data.slot)
    )
      throw new UserError(
        "Seçtiğin atölye ve Fortune Dome saatlerin çakışıyor.",
      );
    const ids = [
      ...data.selected,
      ...(data.slot ? [`fortune-${data.slot}`] : []),
    ];
    for (const id of ids) {
      const [w] =
        await sql`SELECT w.*, (SELECT count(*)::int FROM guest_event.reservations r WHERE r.workshop_id=w.id AND r.ticket_id<>${guest.id}) AS occupied FROM guest_event.workshops w WHERE w.id=${id}`;
      if (!w?.enabled)
        throw new UserError(
          "Seçtiğin atölyenin rezervasyonları henüz açılmadı.",
        );
      if (w.capacity !== null && w.occupied >= w.capacity)
        throw new UserError(
          "Seçtiğin saatlerden biri az önce doldu. Atölyelere dönüp başka bir seçim yap.",
        );
    }
    for (const id of data.waitlist) {
      const [w] =
        await sql`SELECT enabled FROM guest_event.workshops WHERE id=${id}`;
      if (!w?.enabled)
        throw new UserError(
          "Bekleme listesine yazıldığın atölyenin rezervasyonları henüz açılmadı.",
        );
    }
    // A reserved place makes its waitlist entry moot; a slot makes the
    // Fortune Dome waitlist moot.
    const targets = [
      ...data.waitlist.filter((id) => !data.selected.includes(id)),
      ...(data.fortuneWaitlist && !data.slot ? ["fortune"] : []),
    ];
    if (!guest.is_demo) {
      await sql`DELETE FROM guest_event.reservations WHERE ticket_id=${guest.id}`;
      for (const id of ids)
        await sql`INSERT INTO guest_event.reservations (ticket_id,workshop_id) VALUES (${guest.id},${id})`;
      await sql`DELETE FROM guest_event.waitlist WHERE ticket_id=${guest.id} AND target<>ALL(${targets}::text[])`;
      for (const target of targets)
        await sql`INSERT INTO guest_event.waitlist (ticket_id,target) VALUES (${guest.id},${target}) ON CONFLICT DO NOTHING`;
    }
    await sql`INSERT INTO guest_event.plans (ticket_id,data) VALUES (${guest.id},${sql.json(data)}) ON CONFLICT (ticket_id) DO UPDATE SET data=EXCLUDED.data,updated_at=now()`;
  });
}
