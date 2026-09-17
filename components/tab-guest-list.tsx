"use client";
import { useState } from "react";
import { addTabGuest } from "@/app/yonetim/adisyon/actions";
import type { Notify } from "@/components/tab-module";
import { useAction } from "@/hooks/use-action";
import { formatMoney, guestRows, openSummary } from "@/lib/tab/calc";
import { submitOnEnter } from "@/lib/tab/forms";
import { guestCategories } from "@/lib/guest/admin-types";
import type { TabData } from "@/lib/tab/types";

type Filter = "open" | "all" | "closed";
const filters: { id: Filter; label: string }[] = [
  { id: "open", label: "Açık" },
  { id: "all", label: "Hepsi" },
  { id: "closed", label: "Kapalı" },
];

export function TabGuestList({
  data,
  onOpen,
  refresh,
  notify,
}: {
  data: TabData;
  onOpen: (id: string) => void;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const create = useAction();
  const rows = guestRows(data, filter, query);
  const open = openSummary(data);
  const addGuest = (guestName: string) =>
    create.run(
      "Bağlantı kesildi. Tekrar dene.",
      () => addTabGuest(guestName),
      async (r) => {
        if (!r.ok) return;
        setName("");
        setQuery("");
        setAdding(false);
        notify(guestName.trim() + " eklendi");
        await refresh();
        onOpen(r.id);
      },
    );

  return (
    <section aria-labelledby="tab-list-title">
      <h1 id="tab-list-title" className="tab-title">
        Hesaplar
      </h1>
      <p className="tab-open-summary">
        {open.open
          ? `${open.open} açık hesap · ${formatMoney(open.due)} bekliyor`
          : "Açık hesap yok"}
      </p>
      <div className="tab-toolbar">
        <input
          type="search"
          aria-label="Misafir ara"
          placeholder="Misafir ara…"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="ad-primary"
          aria-expanded={adding}
          aria-controls="tab-add-guest"
          onClick={() => {
            setAdding(!adding);
            create.setError("");
          }}
        >
          + Misafir
        </button>
      </div>
      {adding && (
        <form
          id="tab-add-guest"
          className="tab-add-guest"
          onSubmit={(e) => {
            e.preventDefault();
            void addGuest(name);
          }}
        >
          <label htmlFor="tab-guest-name">Misafir adı</label>
          <div className="tab-row">
            <input
              id="tab-guest-name"
              autoFocus
              required
              maxLength={120}
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={submitOnEnter}
            />
            <button className="ad-primary" disabled={create.busy}>
              {create.busy ? "Ekleniyor…" : "Ekle ve aç"}
            </button>
          </div>
          {create.error && (
            <p className="ad-error" role="alert">
              {create.error}
            </p>
          )}
        </form>
      )}
      <div className="tab-chips" role="group" aria-label="Durum filtresi">
        {filters.map((f) => (
          <button
            key={f.id}
            className="tab-chip"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="tab-guests">
        {rows.map((g) => (
          <li key={g.id}>
            <button className="tab-guest" onClick={() => onOpen(g.id)}>
              <span className="tab-guest-main">
                <span className="tab-guest-name">{g.name}</span>
                <span className="tab-guest-sub">
                  {g.category && `${guestCategories[g.category]} · `}
                  {g.count} kalem · {formatMoney(g.total)} toplam
                  {g.discountPercent > 0 && ` · %${g.discountPercent} indirim`}
                </span>
              </span>
              <span className={`ad-badge ${g.status === "open" ? "pending" : "done"}`}>
                {g.pendingMethod === "iban"
                  ? "IBAN bekleniyor"
                  : g.status === "open"
                    ? "Açık"
                    : "Kapalı"}
              </span>
              <span className={`tab-due ${g.due > 0 ? "owe" : "zero"}`}>
                {formatMoney(g.due)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!rows.length && (
        <div className="ad-empty">
          <p>
            {data.guests.length
              ? "Bu filtreye uygun misafir yok."
              : "Henüz misafir yok. “+ Misafir” ile ekle; yönetici Ayarlar’dan toplu liste de yapıştırabilir."}
          </p>
          {query.trim().length > 0 &&
            !data.guests.some(
              (g) => g.name.toLocaleLowerCase("tr") === query.trim().toLocaleLowerCase("tr"),
            ) && (
              <button
                className="ad-primary"
                disabled={create.busy}
                onClick={() => void addGuest(query.trim())}
              >
                “{query.trim()}” adıyla misafir ekle
              </button>
            )}
          {create.error && !adding && (
            <p className="ad-error" role="alert">
              {create.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
