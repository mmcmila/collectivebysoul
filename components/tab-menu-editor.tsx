"use client";
import { useState } from "react";
import { deleteMenuItem, saveMenu } from "@/app/yonetim/adisyon/actions";
import { confirmAction } from "@/components/confirm-dialog";
import type { Notify } from "@/components/tab-module";
import { useAction } from "@/hooks/use-action";
import { formatLiraInput, parseAmount } from "@/lib/tab/calc";
import {
  stations,
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

/**
 * Menu editor: add products, change prices, hide what ran out. Open to all
 * staff; deleting a product for good stays with the organiser (canDelete).
 */
export function TabMenuEditor({
  data,
  refresh,
  notify,
  canDelete = false,
  defaultOpen = false,
}: {
  data: TabData;
  refresh: () => Promise<void>;
  notify: Notify;
  canDelete?: boolean;
  defaultOpen?: boolean;
}) {
  // null while not editing: rows then follow polling updates from the server.
  const [draft, setDraft] = useState<DraftRow[] | null>(null);
  const dirty = draft !== null;
  const rows = draft ?? toDraft(data.menu);
  const menuAction = useAction();

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
    <details className="tab-card tab-collapsible" open={defaultOpen}>
      <summary>
        <h2>Menü</h2>
        <span>
          {rows.filter((r) => r.active).length} aktif ürün
          {dirty && " · kaydedilmemiş değişiklik"}
        </span>
      </summary>
      <p className="ad-note">
        Fiyatlar ₺ cinsinden. Biten ürünü “Aktif”e basıp “Pasif” yap: menüde
        görünmez, gelince tekrar aç. Geçmiş satırlar fiyat değişikliğinden
        etkilenmez. Yemek bölümü pizza, hot dog ve diğer yiyecekler içindir.
        Her değişiklik işlem geçmişine yazılır
        {canDelete ? "." : "; ürünü kalıcı silmek yöneticidedir."}
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
                    {(canDelete || row.id === null) && (
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
                    )}
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
  );
}
