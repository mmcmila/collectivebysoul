"use client";
import { useState } from "react";
import { addMenuItem } from "@/app/yonetim/adisyon/actions";
import type { Notify } from "@/components/tab-module";
import { formatMoney, parseAmount } from "@/lib/tab/calc";
import { stations, type StaffUser, type Station } from "@/lib/tab/types";

/**
 * Quick way to enter a drink that is missing from the menu while serving.
 * Staff add to their own station; the organiser picks one. Prices and hiding
 * are edited in the menu editor (TabMenuEditor).
 */
export function TabMenuAdd({
  user,
  station,
  refresh,
  notify,
}: {
  user: StaffUser;
  station: Station;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [chosen, setChosen] = useState<Station | null>(null);
  const [busy, setBusy] = useState(false);
  const isAdmin = user.role === "admin";
  const target = isAdmin ? (chosen ?? station) : station;

  const submit = async () => {
    const clean = name.trim();
    const value = parseAmount(price);
    if (!clean) return notify("Ürün adını yaz.", "error");
    if (value === undefined || value === null)
      return notify("Fiyatı yaz, örn. 350.", "error");
    setBusy(true);
    const r = await addMenuItem(clean, value, target).catch(() => ({
      error: "Bağlantı yok. Ürün eklenmedi.",
    }));
    setBusy(false);
    if (r.error) return notify(r.error, "error");
    notify(`Menüye eklendi: ${clean} · ${formatMoney(value)}`);
    setName("");
    setPrice("");
    setOpen(false);
    await refresh();
  };

  return (
    <div className="tab-menu-add">
      <button
        type="button"
        className="tab-secondary"
        aria-expanded={open}
        aria-controls="tab-menu-add-form"
        onClick={() => setOpen(!open)}
      >
        {open ? "Vazgeç" : "+ Menüde yok, yeni ürün ekle"}
      </button>
      {open && (
        <form
          id="tab-menu-add-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="tab-row">
            <label className="tab-visually-hidden" htmlFor="tab-menu-add-name">
              Ürün adı
            </label>
            <input
              id="tab-menu-add-name"
              autoComplete="off"
              maxLength={80}
              placeholder="Ürün adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="tab-visually-hidden" htmlFor="tab-menu-add-price">
              Fiyat (₺)
            </label>
            <input
              id="tab-menu-add-price"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Fiyat ₺"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          {isAdmin && (
            <div className="tab-chips" role="group" aria-label="İstasyon">
              {(Object.keys(stations) as Station[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  className="tab-chip"
                  aria-pressed={target === s}
                  onClick={() => setChosen(s)}
                >
                  {stations[s]}
                </button>
              ))}
            </div>
          )}
          <button className="ad-primary" disabled={busy}>
            {busy ? "Ekleniyor…" : `${stations[target]} menüsüne ekle`}
          </button>
          <p className="ad-note">
            Ürün hemen menüde görünür. Fiyat değiştirmek veya biten ürünü
            gizlemek için {isAdmin ? "Ayarlar → Menü" : "üstteki Menü sekmesi"}.
          </p>
        </form>
      )}
    </div>
  );
}
