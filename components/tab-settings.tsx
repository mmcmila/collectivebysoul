"use client";
import { confirmAction } from "@/components/confirm-dialog";
import { useState } from "react";
import {
  addTabGuestsBulk,
  deleteBankAccount,
  deleteMenuItem,
  saveBankAccounts,
  saveDiscountRules,
  saveMenu,
} from "@/app/yonetim/adisyon/actions";
import { guestCategories } from "@/lib/guest/admin-types";
import { StaffCodes } from "@/components/staff-codes";
import type { Notify } from "@/components/tab-module";
import { useAction } from "@/hooks/use-action";
import { formatLiraInput, parseAmount } from "@/lib/tab/calc";
import {
  stations,
  type BankAccountDraft,
  type DiscountRuleDraft,
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
  type RuleRow = DiscountRuleDraft & { key: string; percentText: string };
  const toRuleDraft = (rules: TabData["discountRules"]): RuleRow[] =>
    rules.map((r) => ({
      key: r.id,
      id: r.id,
      kind: r.kind,
      category: r.category,
      guestId: r.guestId,
      percent: r.percent,
      percentText: String(r.percent),
      label: r.label,
    }));
  const [ruleDraft, setRuleDraft] = useState<RuleRow[] | null>(null);
  const ruleRows = ruleDraft ?? toRuleDraft(data.discountRules);
  const editRule = (key: string, patch: Partial<RuleRow>) =>
    setRuleDraft(ruleRows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const ruleAction = useAction();
  const submitRules = () => {
    const items: DiscountRuleDraft[] = [];
    for (const r of ruleRows) {
      const percent = Number(r.percentText.replace(",", "."));
      if (!Number.isInteger(percent) || percent < 0 || percent > 100)
        return ruleAction.setError("Her kural için 0–100 arasında bir yüzde yaz.");
      if (r.kind === "guest" && !r.guestId)
        return ruleAction.setError("Kişiye özel kural için misafir seç.");
      items.push({
        id: r.id,
        kind: r.kind,
        category: r.kind === "category" ? r.category : null,
        guestId: r.kind === "guest" ? r.guestId : null,
        percent,
        label: r.label,
      });
    }
    void ruleAction.run(
      "Bağlantı kesildi. Kurallar kaydedilmedi.",
      () => saveDiscountRules(items),
      async () => {
        setRuleDraft(null);
        notify("İndirim kuralları kaydedildi");
        await refresh();
      },
    );
  };
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

      <details className="tab-card tab-collapsible">
        <summary>
          <h2>Menü</h2>
          <span>
            {rows.filter((r) => r.active).length} aktif ürün
            {dirty && " · kaydedilmemiş değişiklik"}
          </span>
        </summary>
        <p className="ad-note">
          Fiyatlar ₺ cinsinden. Pasif ürünler menüde görünmez; geçmiş satırlar
          fiyat değişikliğinden etkilenmez. Yemek bölümü pizza, hot dog ve
          diğer yiyecekler içindir.
        </p>
        {(Object.keys(stations) as Station[]).map((station) => {
          const group = rows.filter((r) => r.station === station);
          return (
            <details key={station} className="tab-menu-group" open>
              <summary>
                <strong>{stations[station]} menüsü</strong>
                <span>{group.length} ürün</span>
              </summary>
              <div className="tab-menu-edit">
                {group.map((row, index) => (
                  <div
                    key={row.key}
                    className={`tab-menu-row ${row.active ? "" : "passive"}`}
                  >
                    <label>
                      <span>Ürün</span>
                      <input
                        value={row.name}
                        maxLength={80}
                        placeholder="Ürün adı"
                        aria-label={`${stations[station]} ${index + 1}. ürün adı`}
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
                      <span>Bölüm</span>
                      <select
                        value={row.station}
                        aria-label={`${row.name || index + 1 + ". ürün"} bölümü`}
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
                    <div className="tab-row-actions">
                      <button
                        type="button"
                        className="tab-chip"
                        aria-pressed={row.active}
                        onClick={() => edit(row.key, { active: !row.active })}
                      >
                        {row.active ? "Aktif" : "Pasif"}
                      </button>
                      <button
                        type="button"
                        className="tab-x"
                        aria-label={`${row.name || "ürün"} sil`}
                        disabled={menuAction.busy}
                        onClick={async () => {
                          if (row.id === null)
                            return setDraft(rows.filter((r) => r.key !== row.key));
                          if (
                            !(await confirmAction(
                              `${row.name} menüden silinsin mi? Geçmiş satışlar korunur.`,
                            ))
                          )
                            return;
                          void menuAction.run(
                            "Bağlantı kesildi.",
                            () => deleteMenuItem(row.id as string),
                            async () => {
                              setDraft(null);
                              notify("Ürün silindi");
                              await refresh();
                            },
                          );
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {!group.length && <p className="ad-note">Bu bölümde ürün yok.</p>}
              </div>
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
                      station,
                      active: true,
                    },
                  ])
                }
              >
                + {stations[station]} ürünü
              </button>
            </details>
          );
        })}
        <div className="tab-row">
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
      </details>

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
              <div className="tab-row-actions">
                <button
                  type="button"
                  className="tab-chip"
                  aria-pressed={row.active}
                  onClick={() => editAccount(row.key, { active: !row.active })}
                >
                  {row.active ? "Aktif" : "Pasif"}
                </button>
                <button
                  type="button"
                  className="tab-x"
                  aria-label={`${row.label || "IBAN"} sil`}
                  disabled={ibanAction.busy}
                  onClick={async () => {
                    if (row.id === null)
                      return setAccountDraft(accountRows.filter((r) => r.key !== row.key));
                    if (!(await confirmAction(`${row.label} IBAN’ı silinsin mi?`)))
                      return;
                    void ibanAction.run(
                      "Bağlantı kesildi.",
                      () => deleteBankAccount(row.id as string),
                      async () => {
                        setAccountDraft(null);
                        notify("IBAN silindi");
                        await refresh();
                      },
                    );
                  }}
                >
                  ✕
                </button>
              </div>
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

      <section className="tab-card" aria-labelledby="tab-discount-rules-title">
        <h2 id="tab-discount-rules-title">İndirimler</h2>
        <p className="ad-note">
          Katılımcı türüne (Ekipten / Misafir / Biletli) veya kişiye özel
          yüzde. Yeni siparişlere uygulanır; kural silinse de daha önce
          eklenen kalemler indirimli kalır. Kişi profilinden de değiştirilebilir.
        </p>
        <div className="tab-menu-edit">
          {ruleRows.map((row) => (
            <div key={row.key} className="tab-menu-row tab-rule-row">
              <label>
                <span>Kim için</span>
                <select
                  value={row.kind === "guest" ? "guest:" + (row.guestId ?? "") : "category:" + (row.category ?? "team")}
                  onChange={(e) => {
                    const [kind, value] = e.target.value.split(":");
                    editRule(
                      row.key,
                      kind === "guest"
                        ? { kind: "guest", guestId: value || null, category: null }
                        : { kind: "category", category: value as "paid" | "team" | "guest", guestId: null },
                    );
                  }}
                >
                  {(Object.keys(guestCategories) as ("paid" | "team" | "guest")[]).map((c) => (
                    <option key={c} value={"category:" + c}>
                      Tüm {guestCategories[c].toLocaleLowerCase("tr")} katılımcılar
                    </option>
                  ))}
                  <option value="guest:">Kişiye özel…</option>
                  {data.guests.map((g) => (
                    <option key={g.id} value={"guest:" + g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Yüzde</span>
                <input
                  inputMode="numeric"
                  value={row.percentText}
                  placeholder="35"
                  aria-label="İndirim yüzdesi"
                  onChange={(e) => editRule(row.key, { percentText: e.target.value })}
                />
              </label>
              <label>
                <span>Not</span>
                <input
                  value={row.label}
                  maxLength={80}
                  placeholder="Örn. Ekip indirimi"
                  aria-label="Kural notu"
                  onChange={(e) => editRule(row.key, { label: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="tab-x"
                aria-label="Kuralı sil"
                onClick={() => setRuleDraft(ruleRows.filter((r) => r.key !== row.key))}
              >
                ✕
              </button>
            </div>
          ))}
          {!ruleRows.length && <p className="ad-note">Henüz kural yok.</p>}
        </div>
        <div className="tab-row">
          <button
            type="button"
            className="tab-secondary"
            onClick={() =>
              setRuleDraft([
                ...ruleRows,
                {
                  key: "new-" + crypto.randomUUID(),
                  id: null,
                  kind: "category",
                  category: "team",
                  guestId: null,
                  percent: 0,
                  percentText: "",
                  label: "",
                },
              ])
            }
          >
            + Kural
          </button>
          <button
            className="ad-primary"
            disabled={ruleAction.busy || ruleDraft === null}
            onClick={submitRules}
          >
            {ruleAction.busy ? "Kaydediliyor…" : "Kuralları kaydet"}
          </button>
        </div>
        {ruleAction.error && (
          <p className="ad-error" role="alert">
            {ruleAction.error}
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
