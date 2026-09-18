"use client";
import { confirmAction } from "@/components/confirm-dialog";
import { useState } from "react";
import {
  changeFortuneSchedule,
  manageFortune,
  updateParticipant,
} from "@/app/yonetim/actions";
import { useAction } from "@/hooks/use-action";
import { FORTUNE_MAX_SLOTS, FORTUNE_SLOT_MINUTES } from "@/lib/guest/fortune";
import {
  guestCategories,
  type AdminGuest,
  type AdminWorkshop,
} from "@/lib/guest/admin-types";

export function ParticipantControls({
  guest: g,
  refresh,
}: {
  guest: AdminGuest;
  refresh: () => Promise<void>;
}) {
  const { busy, error, run } = useAction();
  const save = (category: string, active: boolean) =>
    run(
      "Değişiklik kaydedilemedi.",
      () => updateParticipant(g.id, category, active),
      refresh,
    );
  return (
    <div className="ad-person-controls">
      <label>
        Katılımcı türü{" "}
        <select
          disabled={busy}
          value={g.category}
          onChange={(e) => void save(e.target.value, g.active)}
        >
          {Object.entries(guestCategories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy}
        className="ad-detail-button"
        onClick={async () => {
          if (
            g.active &&
            !(await confirmAction(
              g.name +
                " listeden kaldırılsın mı? Giriş kodu kapanır ve rezervasyonları serbest kalır.",
              "Listeden kaldır",
            ))
          )
            return;
          void save(g.category, !g.active);
        }}
      >
        {g.active ? "Listeden kaldır" : "Geri ekle"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function FortuneEditor({
  workshop: w,
  guests,
  refresh,
}: {
  workshop: AdminWorkshop;
  guests: AdminGuest[];
  refresh: () => Promise<void>;
}) {
  const [person, setPerson] = useState(w.guests[0]?.id ?? "");
  const [enabled, setEnabled] = useState(w.enabled);
  const { busy, error, run } = useAction();
  const slot = w.id.replace("fortune-", "");
  return (
    <form
      className="ad-slot-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          w.guests.length &&
          person !== w.guests[0].id &&
          !(await confirmAction(
            slot +
              " saatindeki " +
              w.guests[0].name +
              " rezervasyonu kaldırılsın mı?",
            "Kaldır",
          ))
        )
          return;
        void run(
          "Saat kaydedilemedi.",
          () =>
            manageFortune(
              slot,
              enabled,
              person || null,
              w.guests[0]?.id ?? null,
            ),
          refresh,
        );
      }}
    >
      <h3>
        {slot} <small>· 15 dk</small>
      </h3>
      <p>{w.guests.map((g) => g.name).join(", ") || "Rezervasyon yok"}</p>
      <label>
        Katılımcı
        <select
          aria-label={slot + " katılımcısı"}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          disabled={busy}
        >
          <option value="">Boş bırak / rezervasyonu kaldır</option>
          {guests
            .filter((g) => g.active && !g.isDemo && g.plan)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
        </select>
      </label>
      <label className="ad-check">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (!e.target.checked) setPerson("");
          }}
        />
        Rezervasyona açık
      </label>
      <button className="ad-detail-button" disabled={busy}>
        {busy ? "Kaydediliyor…" : "Kaydet"}
      </button>
      <button
        type="button"
        className="ad-remove-slot"
        disabled={busy || w.booked > 0}
        title={w.booked ? "Önce rezervasyonu taşı veya kaldır." : undefined}
        onClick={async () => {
          if (!(await confirmAction(slot + " saati programdan çıkarılsın mı?", "Çıkar")))
            return;
          void run(
            "Saat kaldırılamadı.",
            () => changeFortuneSchedule("remove", slot),
            refresh,
          );
        }}
      >
        Saati programdan çıkar
      </button>
      {error && (
        <p className="ad-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function FortuneScheduleControls({
  count,
  refresh,
}: {
  count: number;
  refresh: () => Promise<void>;
}) {
  const [slot, setSlot] = useState("");
  const { busy, error, run } = useAction();
  return (
    <div className="ad-fortune-controls">
      <p>
        <strong>
          {count} seans · {count * FORTUNE_SLOT_MINUTES} dakika
        </strong>
        <br />
        En fazla 14 seans / 3 saat 30 dakika. Her seans 15 dakika ve 1
        kişiliktir.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            "Saat eklenemedi.",
            () => changeFortuneSchedule("add", slot),
            () => {
              setSlot("");
              return refresh();
            },
          );
        }}
      >
        <label>
          Yeni seans başlangıcı
          <input
            type="time"
            min="14:00"
            max="23:45"
            step={900}
            required
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            disabled={busy || count >= FORTUNE_MAX_SLOTS}
          />
        </label>
        <button
          className="ad-primary"
          disabled={busy || count >= FORTUNE_MAX_SLOTS}
        >
          {busy ? "Ekleniyor…" : "+ Saat ekle"}
        </button>
      </form>
      {count >= FORTUNE_MAX_SLOTS && (
        <p className="ad-note">
          3,5 saat sınırına ulaşıldı. Saati değiştirmek için önce boş bir seansı
          çıkarıp yenisini ekle.
        </p>
      )}
      {error && (
        <p className="ad-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
