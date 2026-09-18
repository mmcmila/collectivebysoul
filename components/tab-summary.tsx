"use client";
import { confirmAction } from "@/components/confirm-dialog";
import { useState } from "react";
import { clearAudit, deleteAuditEntry } from "@/app/yonetim/adisyon/actions";
import type { Notify } from "@/components/tab-module";
import { describeAudit, formatMoney, formatTime, summarize } from "@/lib/tab/calc";
import { paymentMethods, stations, type TabData } from "@/lib/tab/types";

export function TabSummary({
  data,
  refresh,
  notify,
}: {
  data: TabData;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const s = summarize(data);
  const [busy, setBusy] = useState(false);
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
        <div className={s.due > 0 ? "owe" : "zero"}>
          <span>Açık</span>
          <strong>{formatMoney(s.due)}</strong>
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
        <h2 id="tab-debtors">Açık hesaplar · borcu olanlar ({s.debtors.length})</h2>
        {s.debtors.length ? (
          <table className="tab-table">
            <tbody>
              {s.debtors.map((g) => (
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
      {s.overpaid.length > 0 && (
        <section className="tab-card" aria-labelledby="tab-overpaid">
          <h2 id="tab-overpaid">Fazla ödeme · iade gerekebilir ({s.overpaid.length})</h2>
          <p className="ad-note">
            Bu misafirlerden siparişlerinin tutarından fazla para alınmış
            görünüyor; genelde ödeme alındıktan sonra ürün silinince olur.
            Parayı iade et ya da yanlış ödemeyi profilden sil. Bu yüzden
            Tahsil, Satış + Açık toplamından yüksek çıkabilir.
          </p>
          <table className="tab-table">
            <tbody>
              {s.overpaid.map((g) => (
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
        <h2 id="tab-settled">Kapalı hesaplar · ödeyenler ({s.settled.length})</h2>
        {s.settled.length ? (
          <table className="tab-table">
            <tbody>
              {s.settled.map((g) => (
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
          <ul className="tab-lines tab-audit">
            {data.audit.map((entry) => (
              <li key={entry.id}>
                <span className="tab-line-main">
                  <span className="tab-line-name">{describeAudit(entry)}</span>
                  <span className="tab-line-sub">
                    {formatTime(entry.createdAt)} · {entry.actorName}
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
    </section>
  );
}
