"use client";

import { confirmAction } from "@/components/confirm-dialog";
import { useRef, useState } from "react";
import { removeWorkshopParticipant } from "@/app/yonetim/actions";
import { useAction } from "@/hooks/use-action";
import type { AdminWorkshop, WaitlistEntry } from "@/lib/guest/admin-types";

export function AdminWorkshops({
  workshops,
  names,
  waitlist,
  refresh,
}: {
  workshops: AdminWorkshop[];
  names: Record<string, string>;
  waitlist: WaitlistEntry[];
  refresh: () => Promise<void>;
}) {
  const waiting = (id: string) => waitlist.filter((w) => w.target === id);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const { busy, error, setError, run } = useAction();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const workshop = workshops.find((w) => w.id === selected);

  async function remove(guest: { id: string; name: string }) {
    if (
      !selected ||
      !(await confirmAction(
        `${guest.name}, ${names[selected]} atölyesinden çıkarılsın mı? Diğer atölyeleri ve etkinlik kaydı korunur.`,
        "Çıkar",
      ))
    )
      return;
    setMessage("");
    await run(
      "İşlemin son durumu alınamadı. Listeyi yenileyerek kontrol et.",
      () => removeWorkshopParticipant(selected, guest.id),
      async () => {
        setMessage(`${guest.name} atölyeden çıkarıldı.`);
        await refresh();
        requestAnimationFrame(() => trigger.current?.focus());
      },
    );
  }

  return (
    <>
      <p className="ad-note">
        Katılımcıları görmek ve düzenlemek için bir atölyeye tıkla.
      </p>
      <div className="ad-workshops">
        {Object.entries(names).map(([id, title]) => {
          const w = workshops.find((item) => item.id === id);
          return (
            <article
              key={id}
              className={selected === id ? "ad-workshop-selected" : undefined}
            >
              <h3>
                <button
                  ref={selected === id ? trigger : undefined}
                  className="ad-workshop-toggle"
                  disabled={busy}
                  aria-expanded={selected === id}
                  aria-controls="workshop-participants"
                  onClick={() => {
                    setSelected(selected === id ? null : id);
                    setError("");
                    setMessage("");
                  }}
                >
                  {title}
                </button>
              </h3>
              <div>
                <strong>
                  {w?.booked ?? 0}
                  <small> / {w?.capacity ?? "—"}</small>
                </strong>
                <span>
                  {w?.enabled
                    ? w.capacity === null
                      ? "Kontenjan sınırı yok"
                      : `${Math.max(0, w.capacity - w.booked)} yer kaldı`
                    : "Kapalı"}
                  {waiting(id).length > 0 &&
                    ` · ${waiting(id).length} kişi bekleme listesinde`}
                </span>
              </div>
              <progress
                aria-label={`${title} doluluk`}
                value={w?.booked ?? 0}
                max={w?.capacity ?? Math.max(1, w?.booked ?? 0)}
              />
            </article>
          );
        })}
      </div>
      <div
        id="workshop-participants"
        hidden={!selected}
        className="ad-workshop-participants"
        aria-busy={busy}
      >
        {selected && (
          <>
            <div className="ad-section-heading">
              <h3>{names[selected]} · Katılımcılar</h3>
              <span>{workshop?.guests.length ?? 0} kişi</span>
            </div>
            {workshop?.guests.length ? (
              <ul>
                {[...workshop.guests]
                  .sort((a, b) => a.name.localeCompare(b.name, "tr"))
                  .map((guest) => (
                    <li key={guest.id}>
                      <span>{guest.name}</span>
                      <button
                        className="ad-detail-button"
                        disabled={busy}
                        aria-label={`${guest.name} adlı kişiyi atölyeden çıkar`}
                        onClick={() => void remove(guest)}
                      >
                        Atölyeden çıkar
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p>Bu atölyede henüz katılımcı yok.</p>
            )}
            {waiting(selected).length > 0 && (
              <p className="ad-waitlist">
                <strong>Bekleme listesi (katılım sırasıyla):</strong>{" "}
                {waiting(selected)
                  .map((w, i) => `${i + 1}. ${w.name}`)
                  .join(" · ")}
                <br />
                <small>
                  Yer açılınca sıradaki kişiye haber ver; kişi planına girip
                  atölyeyi seçtiğinde listeden çıkar.
                </small>
              </p>
            )}
            <p className="ad-note">
              Burada aktif, gerçek rezervasyonlar listelenir. Çıkarma işlemi
              kişinin yalnızca bu atölye kaydını kaldırır.
            </p>
          </>
        )}
      </div>
      <p role="status">{message}</p>
      {error && (
        <p className="ad-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
