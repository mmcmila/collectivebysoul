"use client";
import { describeAudit, formatMoney, formatTime, summarize } from "@/lib/tab/calc";
import { paymentMethods, stations, type TabData } from "@/lib/tab/types";

export function TabSummary({ data }: { data: TabData }) {
  const s = summarize(data);
  return (
    <section aria-labelledby="tab-summary-title">
      <h1 id="tab-summary-title" className="tab-title">
        Özet
      </h1>
      <div className="tab-totals">
        <div>
          <span>Satış</span>
          <strong>{formatMoney(s.total)}</strong>
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
      <section className="tab-card" aria-labelledby="tab-items">
        <h2 id="tab-items">Ürün bazında</h2>
        {s.byItem.length ? (
          <table className="tab-table">
            <thead>
              <tr>
                <th scope="col">Ürün</th>
                <th scope="col">Adet</th>
                <th scope="col">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {s.byItem.map((item) => (
                <tr key={item.name}>
                  <th scope="row">{item.name}</th>
                  <td>{item.qty}</td>
                  <td>{formatMoney(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="ad-note">Henüz satış yok.</p>
        )}
      </section>
      <section className="tab-card" aria-labelledby="tab-debtors">
        <h2 id="tab-debtors">Borcu olanlar</h2>
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
      {data.audit.length > 0 && (
        <section className="tab-card" aria-labelledby="tab-audit">
          <h2 id="tab-audit">Silme kaydı</h2>
          <p className="ad-note">
            Yanlış girişleri düzeltmek için silinen kalemler ve ödemeler; kim,
            ne zaman. Yalnızca yönetici görür.
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
              </li>
            ))}
          </ul>
        </section>
      )}
      <a className="tab-secondary tab-csv" href="/yonetim/hesap/csv" download>
        CSV indir
      </a>
      <p className="ad-note">
        Tüm satışlar ve ödemeler tek dosyada; noktalı virgülle ayrılmış, Türkçe
        Excel’de doğrudan açılır.
      </p>
    </section>
  );
}
