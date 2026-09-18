"use client";
import { confirmAction } from "@/components/confirm-dialog";
import { useState } from "react";
import {
  clearAudit,
  deleteAuditEntry,
  resetTabData,
} from "@/app/yonetim/adisyon/actions";
import type { Notify } from "@/components/tab-module";
import {
  businessDay,
  describeAudit,
  filterEntries,
  formatDateTime,
  formatMoney,
  summarize,
} from "@/lib/tab/calc";
import { paymentMethods, stations, type TabData } from "@/lib/tab/types";

export function TabSummary({
  data,
  isAdmin,
  refresh,
  notify,
}: {
  data: TabData;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  // Filter: one business day (06:00–06:00) and/or one staff member.
  const [day, setDay] = useState<string | null>(null);
  const [staff, setStaff] = useState<string | null>(null);
  const today = businessDay(data.fetchedAt);
  const filtered = day !== null || staff !== null;
  const staffNames = [
    ...new Set(
      [...data.lines, ...data.payments]
        .map((x) => x.createdByName)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "tr"));
  // Sales figures follow the filter; who owes or paid is always the current state.
  const s = summarize({
    ...data,
    lines: filterEntries(data.lines, { day, staff }),
    payments: filterEntries(data.payments, { day, staff }),
  });
  const state = filtered ? summarize(data) : s;
  const audit = data.audit.filter(
    (entry) =>
      (!day || businessDay(entry.createdAt) === day) &&
      (!staff || entry.actorName === staff),
  );
  const [busy, setBusy] = useState(false);
  const [resetWord, setResetWord] = useState("");
  const reset = async () => {
    setBusy(true);
    const r = await resetTabData(resetWord).catch(() => ({
      error: "Bağlantı yok. Sıfırlanmadı.",
    }));
    setBusy(false);
    if (r.error) return notify(r.error, "error");
    setResetWord("");
    setDay(null);
    setStaff(null);
    notify("Adisyon sıfırlandı");
    await refresh();
  };
  // The activity log is only sent to the organiser, who may also clean it up.
  const cleanAudit = async (
    run: () => Promise<{ error?: string }>,
    done: string,
  ) => {
    setBusy(true);
    const r = await run().catch(() => ({
      error: "Bağlantı yok. İşlem kaydedilmedi.",
    }));
    setBusy(false);
    if (r.error) return notify(r.error, "error");
    notify(done);
    await refresh();
  };
  return (
    <section aria-labelledby="tab-summary-title">
      <h1 id="tab-summary-title" className="tab-title">
        Özet
      </h1>
      <div className="tab-summary-filter" role="group" aria-label="Özet filtresi">
        <div className="tab-chips">
          <button
            className="tab-chip"
            aria-pressed={day === null}
            onClick={() => setDay(null)}
          >
            Tüm günler
          </button>
          <button
            className="tab-chip"
            aria-pressed={day === today}
            onClick={() => setDay(today)}
          >
            Bugün
          </button>
          <label className="tab-visually-hidden" htmlFor="tab-summary-day">
            Gün seç
          </label>
          <input
            id="tab-summary-day"
            type="date"
            value={day ?? ""}
            max={today}
            onChange={(e) => setDay(e.target.value || null)}
          />
        </div>
        {staffNames.length > 0 && (
          <>
            <label className="tab-visually-hidden" htmlFor="tab-summary-staff">
              Personel
            </label>
            <select
              id="tab-summary-staff"
              value={staff ?? ""}
              onChange={(e) => setStaff(e.target.value || null)}
            >
              <option value="">Tüm personel</option>
              {staffNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {filtered && (
        <p className="ad-note">
          Filtre açık: satış, tahsilat ve ürünler seçilen{" "}
          {day && staff ? "gün ve personele" : day ? "güne" : "personele"} göre.
          Gün 06:00’da başlar; gece yarısından sonraki satışlar aynı geceye
          sayılır. Borç ve ödeyen listeleri her zaman güncel durumu gösterir.{" "}
          <button
            type="button"
            className="tab-link"
            onClick={() => {
              setDay(null);
              setStaff(null);
            }}
          >
            Filtreyi kaldır
          </button>
        </p>
      )}
      <div className="tab-totals">
        <div>
          <span>Satış</span>
          <strong>{formatMoney(s.total)}</strong>
          {(s.discount > 0 || s.complimentary > 0) && (
            <small>
              {s.discount > 0 && `−${formatMoney(s.discount)} indirim`}
              {s.discount > 0 && s.complimentary > 0 && " · "}
              {s.complimentary > 0 && `${formatMoney(s.complimentary)} ikram`}
            </small>
          )}
        </div>
        <div>
          <span>Tahsil</span>
          <strong>{formatMoney(s.paid)}</strong>
        </div>
        <div className={state.due > 0 ? "owe" : "zero"}>
          <span>Açık</span>
          <strong>{formatMoney(state.due)}</strong>
        </div>
      </div>
      <div className="tab-summary-grid">
        <section className="tab-card" aria-labelledby="tab-methods">
          <h2 id="tab-methods">Tahsilat yöntemi</h2>
          <table className="tab-table">
            <tbody>
              {(Object.keys(paymentMethods) as (keyof typeof paymentMethods)[]).map(
                (m) => (
                  <tr key={m}>
                    <th scope="row">{paymentMethods[m]}</th>
                    <td>{formatMoney(s.byMethod[m])}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </section>
        <section className="tab-card" aria-labelledby="tab-stations">
          <h2 id="tab-stations">İstasyona göre satış</h2>
          <table className="tab-table">
            <tbody>
              {(Object.keys(stations) as (keyof typeof stations)[]).map((st) => (
                <tr key={st}>
                  <th scope="row">{stations[st]}</th>
                  <td>{formatMoney(s.byStation[st])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      {s.byAccount.length > 0 && (
        <section className="tab-card" aria-labelledby="tab-accounts">
          <h2 id="tab-accounts">IBAN hesaplarına göre</h2>
          <table className="tab-table">
            <tbody>
              {s.byAccount.map((a) => (
                <tr key={a.id}>
                  <th scope="row">
                    {a.label}
                    <small className="tab-table-sub">
                      {a.count} ödeme{a.iban ? ` · ${a.iban}` : ""}
                    </small>
                  </th>
                  <td>{formatMoney(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="tab-card" aria-labelledby="tab-items">
        <h2 id="tab-items">Satılan ürünler</h2>
        {s.byItem.length ? (
          <ul className="tab-bars">
            {s.byItem.map((item) => {
              const max = s.byItem[0].qty || 1;
              return (
                <li key={item.name}>
                  <div className="tab-bar-head">
                    <span className="tab-bar-name">
                      {item.name}
                      <small>{stations[item.station]}</small>
                    </span>
                    <strong>
                      {item.qty} adet
                      {item.complimentaryQty > 0 && (
                        <small> · {item.complimentaryQty} ikram</small>
                      )}
                    </strong>
                    <span className="tab-bar-amount">{formatMoney(item.amount)}</span>
                  </div>
                  <div className="tab-bar-track" aria-hidden="true">
                    <div
                      className={`tab-bar-fill ${item.station}`}
                      style={{ width: `${Math.max(4, (item.qty / max) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ad-note">Henüz satış yok.</p>
        )}
      </section>
      <section className="tab-card" aria-labelledby="tab-debtors">
        <h2 id="tab-debtors">Açık hesaplar · borcu olanlar ({state.debtors.length})</h2>
        {state.debtors.length ? (
          <table className="tab-table">
            <tbody>
              {state.debtors.map((g) => (
                <tr key={g.id}>
                  <th scope="row">{g.name}</th>
                  <td className="owe">{formatMoney(g.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ad-note">Açık borç yok.</p>
        )}
      </section>
      {state.overpaid.length > 0 && (
        <section className="tab-card" aria-labelledby="tab-overpaid">
          <h2 id="tab-overpaid">Fazla ödeme · iade gerekebilir ({state.overpaid.length})</h2>
          <p className="ad-note">
            Bu misafirlerden siparişlerinin tutarından fazla para alınmış
            görünüyor; genelde ödeme alındıktan sonra ürün silinince olur.
            Parayı iade et ya da yanlış ödemeyi profilden sil. Bu yüzden
            Tahsil, Satış + Açık toplamından yüksek çıkabilir.
          </p>
          <table className="tab-table">
            <tbody>
              {state.overpaid.map((g) => (
                <tr key={g.id}>
                  <th scope="row">{g.name}</th>
                  <td className="owe">{formatMoney(g.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="tab-card" aria-labelledby="tab-settled">
        <h2 id="tab-settled">Kapalı hesaplar · ödeyenler ({state.settled.length})</h2>
        {state.settled.length ? (
          <table className="tab-table">
            <tbody>
              {state.settled.map((g) => (
                <tr key={g.id}>
                  <th scope="row">{g.name}</th>
                  <td>{formatMoney(g.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ad-note">Hesabının tamamını ödeyen henüz yok.</p>
        )}
      </section>
      {data.audit.length > 0 && (
        <section className="tab-card" aria-labelledby="tab-audit">
          <h2 id="tab-audit">İşlem geçmişi</h2>
          <p className="ad-note">
            Silinen her şey (ürün, ödeme, misafir, menü ürünü, IBAN), ikram ve
            indirim değişiklikleri, personel girişleri; kim, ne zaman. Son 50
            işlem. Personel ürün ve ödeme silebilir ama bu kaydı yalnızca
            yönetici görür ve silebilir.
          </p>
          {!audit.length && (
            <p className="ad-note">Bu filtreye uyan işlem yok.</p>
          )}
          <ul className="tab-lines tab-audit">
            {audit.map((entry) => (
              <li key={entry.id}>
                <span className="tab-line-main">
                  <span className="tab-line-name">{describeAudit(entry)}</span>
                  <span className="tab-line-sub">
                    {formatDateTime(entry.createdAt)} · {entry.actorName}
                  </span>
                </span>
                <button
                  className="tab-x"
                  aria-label={`Kaydı sil: ${describeAudit(entry)}`}
                  disabled={busy}
                  onClick={() =>
                    void cleanAudit(() => deleteAuditEntry(entry.id), "Kayıt silindi")
                  }
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            className="tab-danger"
            disabled={busy}
            onClick={async () => {
              if (
                await confirmAction(
                  "İşlem geçmişinin tamamı silinsin mi? Eski kayıtlar dahil hepsi silinir; bu işlem geri alınamaz.",
                  "Tamamını sil",
                )
              )
                void cleanAudit(clearAudit, "İşlem geçmişi temizlendi");
            }}
          >
            İşlem geçmişinin tamamını sil
          </button>
        </section>
      )}
      <a className="tab-secondary tab-csv" href="/yonetim/adisyon/csv" download>
        CSV indir
      </a>
      <p className="ad-note">
        Tüm satışlar ve ödemeler tek dosyada; noktalı virgülle ayrılmış, Türkçe
        Excel’de doğrudan açılır.
      </p>
      {isAdmin && (
        <section className="tab-card tab-reset" aria-labelledby="tab-reset-title">
          <h2 id="tab-reset-title">Adisyonu sıfırla</h2>
          <p className="ad-note">
            Test kayıtlarından sonra temiz başlamak için: bütün satışlar,
            ödemeler ve işlem geçmişi silinir, Özet sıfırlanır, herkesin hesabı
            “açılmadı”ya döner. Misafir listesi, menü, IBAN’lar, indirim
            kuralları ve personel girişleri kalır. Geri alınamaz; gerekiyorsa
            önce CSV indir. Etkinlik sırasında kullanma.
          </p>
          <form
            className="tab-row"
            onSubmit={(e) => {
              e.preventDefault();
              void reset();
            }}
          >
            <label className="tab-visually-hidden" htmlFor="tab-reset-word">
              Onaylamak için SIFIRLA yaz
            </label>
            <input
              id="tab-reset-word"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Onaylamak için SIFIRLA yaz"
              value={resetWord}
              onChange={(e) => setResetWord(e.target.value)}
            />
            <button
              className="tab-danger"
              disabled={
                busy || resetWord.trim().toLocaleUpperCase("tr") !== "SIFIRLA"
              }
            >
              {busy ? "Sıfırlanıyor…" : "Her şeyi sıfırla"}
            </button>
          </form>
        </section>
      )}
    </section>
  );
}
