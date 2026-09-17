"use client";
import { useState } from "react";
import {
  addTabGuestsBulk,
  saveBankAccounts,
  saveMenu,
} from "@/app/yonetim/adisyon/actions";
import { StaffCodes } from "@/components/staff-codes";
import type { Notify } from "@/components/tab-module";
import { useAction } from "@/hooks/use-action";
import { formatLiraInput, parseAmount } from "@/lib/tab/calc";
import {
  stations,
  type BankAccountDraft,
  type MenuDraftItem,
  type Station,
  type TabData,
} from "@/lib/tab/types";

type DraftRow = Omit<MenuDraftItem, "price"> & { key: string; price: string };

const toDraft = (menu: TabData["menu"]): DraftRow[] =>
  menu.map((m) => ({
    key: m.id,
    id: m.id,
    name: m.name,
    price: formatLiraInput(m.price),
    station: m.station,
    active: m.active,
  }));

export function TabSettings({
  data,
  refresh,
  notify,
}: {
  data: TabData;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  // null while not editing: rows then follow polling updates from the server.
  const [draft, setDraft] = useState<DraftRow[] | null>(null);
  const dirty = draft !== null;
  const rows = draft ?? toDraft(data.menu);
  const menuAction = useAction();
  type AccountRow = BankAccountDraft & { key: string };
  const toAccountDraft = (accounts: TabData["accounts"]): AccountRow[] =>
    accounts.map((a) => ({
      key: a.id,
      id: a.id,
      label: a.label,
      iban: a.iban,
      active: a.active,
    }));
  const [accountDraft, setAccountDraft] = useState<AccountRow[] | null>(null);
  const accountRows = accountDraft ?? toAccountDraft(data.accounts);
  const editAccount = (key: string, patch: Partial<AccountRow>) =>
    setAccountDraft(
      accountRows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  const ibanAction = useAction();
  const [bulk, setBulk] = useState("");
  const bulkAction = useAction();

  const edit = (key: string, patch: Partial<DraftRow>) =>
    setDraft(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submitMenu = () => {
    const items: MenuDraftItem[] = [];
    for (const row of rows) {
      const name = row.name.trim();
      if (!name && row.id === null) continue; // untouched blank row
      const price = parseAmount(row.price);
      if (price === undefined || price === null)
        return menuAction.setError(`"${name || "Yeni ürün"}" için fiyat gir.`);
      items.push({
        id: row.id,
        name,
        price,
        station: row.station,
        active: row.active,
      });
    }
    void menuAction.run(
      "Bağlantı kesildi. Menü kaydedilmedi.",
      () => saveMenu(items),
      async () => {
        setDraft(null);
        notify("Menü kaydedildi");
        await refresh();
      },
    );
  };

  return (
    <section aria-labelledby="tab-settings-title">
      <h1 id="tab-settings-title" className="tab-title">
        Ayarlar
      </h1>

      <section className="tab-card" aria-labelledby="tab-menu-title">
        <h2 id="tab-menu-title">Menü</h2>
        <p className="ad-note">
          Fiyatlar ₺ cinsinden. İstasyon, ürünün satıldığı nokta. Pasif ürünler
          menüde görünmez; geçmiş satırlar fiyat değişikliğinden etkilenmez.
        </p>
        <div className="tab-menu-edit">
          {rows.map((row, index) => (
            <div key={row.key} className={`tab-menu-row ${row.active ? "" : "passive"}`}>
              <label>
                <span>Ürün</span>
                <input
                  value={row.name}
                  maxLength={80}
                  placeholder="Ürün adı"
                  aria-label={`${index + 1}. ürün adı`}
                  onChange={(e) => edit(row.key, { name: e.target.value })}
                />
              </label>
              <label>
                <span>Fiyat ₺</span>
                <input
                  inputMode="decimal"
                  value={row.price}
                  placeholder="0"
                  aria-label={`${row.name || index + 1 + ". ürün"} fiyatı`}
                  onChange={(e) => edit(row.key, { price: e.target.value })}
                />
              </label>
              <label>
                <span>İstasyon</span>
                <select
                  value={row.station}
                  aria-label={`${row.name || index + 1 + ". ürün"} istasyonu`}
                  onChange={(e) =>
                    edit(row.key, { station: e.target.value as Station })
                  }
                >
                  {(Object.keys(stations) as Station[]).map((s) => (
                    <option key={s} value={s}>
                      {stations[s]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="tab-chip"
                aria-pressed={row.active}
                onClick={() => edit(row.key, { active: !row.active })}
              >
                {row.active ? "Aktif" : "Pasif"}
              </button>
            </div>
          ))}
        </div>
        <div className="tab-row">
          <button
            type="button"
            className="tab-secondary"
            onClick={() =>
              setDraft([
                ...rows,
                {
                  key: "new-" + crypto.randomUUID(),
                  id: null,
                  name: "",
                  price: "",
                  station: "bar",
                  active: true,
                },
              ])
            }
          >
            + Ürün
          </button>
          <button
            className="ad-primary"
            disabled={menuAction.busy || !dirty}
            onClick={submitMenu}
          >
            {menuAction.busy ? "Kaydediliyor…" : "Menüyü kaydet"}
          </button>
        </div>
        {menuAction.error && (
          <p className="ad-error" role="alert">
            {menuAction.error}
          </p>
        )}
      </section>

      <section className="tab-card" aria-labelledby="tab-iban-title">
        <h2 id="tab-iban-title">IBAN hesapları</h2>
        <p className="ad-note">
          Birden fazla IBAN olabilir; ödeme alınırken hangi hesaba ödendiği
          seçilir ve Özet’te hesap bazında görünür. Pasif hesap ödeme ekranında
          çıkmaz, eski ödemeleri korunur.
        </p>
        <div className="tab-menu-edit">
          {accountRows.map((row, index) => (
            <div
              key={row.key}
              className={`tab-menu-row tab-account-row ${row.active ? "" : "passive"}`}
            >
              <label>
                <span>Kimin hesabı</span>
                <input
                  value={row.label}
                  maxLength={80}
                  placeholder="Örn. Merve"
                  aria-label={`${index + 1}. IBAN sahibi`}
                  onChange={(e) => editAccount(row.key, { label: e.target.value })}
                />
              </label>
              <label>
                <span>IBAN</span>
                <input
                  value={row.iban}
                  maxLength={60}
                  autoComplete="off"
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  aria-label={`${row.label || index + 1 + ". hesap"} IBAN`}
                  onChange={(e) => editAccount(row.key, { iban: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="tab-chip"
                aria-pressed={row.active}
                onClick={() => editAccount(row.key, { active: !row.active })}
              >
                {row.active ? "Aktif" : "Pasif"}
              </button>
            </div>
          ))}
        </div>
        <div className="tab-row">
          <button
            type="button"
            className="tab-secondary"
            onClick={() =>
              setAccountDraft([
                ...accountRows,
                {
                  key: "new-" + crypto.randomUUID(),
                  id: null,
                  label: "",
                  iban: "",
                  active: true,
                },
              ])
            }
          >
            + IBAN
          </button>
          <button
            className="ad-primary"
            disabled={ibanAction.busy || accountDraft === null}
            onClick={() =>
              void ibanAction.run(
                "Bağlantı kesildi. IBAN listesi kaydedilmedi.",
                () =>
                  saveBankAccounts(
                    accountRows
                      .filter((r) => r.id !== null || r.label.trim() || r.iban.trim())
                      .map(({ id, label, iban, active }) => ({ id, label, iban, active })),
                  ),
                async () => {
                  setAccountDraft(null);
                  notify("IBAN listesi kaydedildi");
                  await refresh();
                },
              )
            }
          >
            {ibanAction.busy ? "Kaydediliyor…" : "IBAN’ları kaydet"}
          </button>
        </div>
        {ibanAction.error && (
          <p className="ad-error" role="alert">
            {ibanAction.error}
          </p>
        )}
      </section>

      <section className="tab-card" aria-labelledby="tab-bulk-title">
        <h2 id="tab-bulk-title">Toplu misafir ekleme</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void bulkAction.run(
              "Bağlantı kesildi. Liste eklenmedi.",
              () => addTabGuestsBulk(bulk),
              async (r) => {
                if (!r.ok) return;
                setBulk("");
                notify(`${r.count} misafir eklendi`);
                await refresh();
              },
            );
          }}
        >
          <label htmlFor="tab-bulk">Her satıra bir isim</label>
          <textarea
            id="tab-bulk"
            rows={6}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
          />
          <button className="ad-primary" disabled={bulkAction.busy || !bulk.trim()}>
            {bulkAction.busy ? "Ekleniyor…" : "Listeyi ekle"}
          </button>
          {bulkAction.error && (
            <p className="ad-error" role="alert">
              {bulkAction.error}
            </p>
          )}
        </form>
      </section>

      <section className="tab-card" aria-labelledby="tab-staff-title">
        <h2 id="tab-staff-title">Personel girişleri</h2>
        <StaffCodes />
      </section>
    </section>
  );
}
