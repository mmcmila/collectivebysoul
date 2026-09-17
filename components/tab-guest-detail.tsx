"use client";
import { useState } from "react";
import {
  addTabLine,
  addTabPayment,
  clearPending,
  closeTabGuest,
  deleteTabGuest,
  deleteTabLine,
  deleteTabPayment,
  markIbanPending,
  setGuestDiscount,
  setLineComplimentary,
} from "@/app/yonetim/adisyon/actions";
import type { Notify } from "@/components/tab-module";
import {
  balanceMessage,
  canDeleteRecord,
  formatMoney,
  formatTime,
  guestTotals,
  parseAmount,
  pastRounds,
  statusAfterPayment,
  statusAfterPaymentRemoved,
  visibleMenu,
} from "@/lib/tab/calc";
import { submitOnEnter } from "@/lib/tab/forms";
import {
  paymentMethods,
  stations,
  type MenuItem,
  type PaymentMethod,
  type StaffUser,
  type Station,
  type TabData,
  type TabGuest,
  type TabLine,
  type TabPayment,
  type TabStatus,
} from "@/lib/tab/types";

type Result = { error?: string };
const isTemp = (id: string) => id.startsWith("tmp-");
const tempId = () => "tmp-" + crypto.randomUUID();
const OFFLINE = "Bağlantı yok. İşlem kaydedilmedi.";

export function TabGuestDetail({
  user,
  station,
  guest,
  data,
  mutate,
  refresh,
  notify,
  onBack,
}: {
  user: StaffUser;
  station: Station;
  guest: TabGuest;
  data: TabData;
  mutate: (update: (current: TabData) => TabData) => void;
  refresh: () => Promise<void>;
  notify: Notify;
  onBack: () => void;
}) {
  const [allMenu, setAllMenu] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const activeAccounts = data.accounts.filter((a) => a.active);
  const [chosenAccount, setChosenAccount] = useState<string | null>(null);
  const account =
    activeAccounts.find((a) => a.id === chosenAccount) ?? activeAccounts[0] ?? null;
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const totals = guestTotals(data.lines, data.payments, guest.id, guest.round);
  const [discountInput, setDiscountInput] = useState("");
  const lines = data.lines.filter(
    (l) => l.guestId === guest.id && l.round === guest.round,
  );
  const payments = data.payments.filter(
    (p) => p.guestId === guest.id && p.round === guest.round,
  );
  const history = pastRounds(data, guest);
  const menu = visibleMenu(data.menu, station, allMenu);
  const isAdmin = user.role === "admin";

  const setStatus = (d: TabData, status: TabStatus): TabData => ({
    ...d,
    guests: d.guests.map((g) => (g.id === guest.id ? { ...g, status } : g)),
  });

  const addItem = async (item: MenuItem) => {
    const id = tempId();
    const previous = guest.status;
    const temp: TabLine = {
      id,
      guestId: guest.id,
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      station: item.station,
      complimentary: false,
      discountPercent: guest.discountPercent,
      round: guest.round,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
    };
    mutate((d) => setStatus({ ...d, lines: [temp, ...d.lines] }, "open"));
    notify("+ " + item.name);
    const r = await addTabLine(guest.id, item.id).catch(
      (): Result => ({ error: OFFLINE }),
    );
    if (!("line" in r) || r.error) {
      mutate((d) =>
        setStatus(
          { ...d, lines: d.lines.filter((l) => l.id !== id) },
          previous,
        ),
      );
      notify(r.error || "Ürün eklenemedi.", "error");
      return;
    }
    mutate((d) =>
      setStatus(
        { ...d, lines: d.lines.map((l) => (l.id === id ? r.line : l)) },
        r.status,
      ),
    );
    // A wrong tap is undone from the toast without a confirm dialog.
    notify("+ " + item.name, "ok", {
      label: "Geri al",
      run: () => void removeLine(r.line, false),
    });
    void refresh();
  };

  const removeLine = async (line: TabLine, confirm = true) => {
    if (confirm && !window.confirm(`${line.name} silinsin mi?`)) return;
    mutate((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== line.id) }));
    const r = await deleteTabLine(line.id).catch(
      (): Result => ({ error: OFFLINE }),
    );
    if (r.error) {
      mutate((d) => ({ ...d, lines: [line, ...d.lines] }));
      notify(r.error, "error");
      return;
    }
    notify("Silindi: " + line.name);
    void refresh();
  };

  const takePayment = async (closing = false) => {
    const parsed = closing ? null : parseAmount(amount);
    if (parsed === undefined) return notify("Tutarı kontrol et.", "error");
    const value = parsed ?? totals.due;
    if (value <= 0) return notify("Bu hesapta kalan borç yok.", "error");
    if (method === "iban" && !account)
      return notify("Önce Ayarlar’dan bir IBAN ekle.", "error");
    if (
      closing &&
      !window.confirm(
        `Kalan ${formatMoney(value)} ${paymentMethods[method]}${method === "iban" && account ? ` (${account.label})` : ""} olarak alınsın ve hesap kapatılsın mı?`,
      )
    )
      return;
    const id = tempId();
    const previous = guest.status;
    const temp: TabPayment = {
      id,
      guestId: guest.id,
      amount: value,
      method,
      accountId: method === "iban" ? account?.id ?? null : null,
      accountLabel: method === "iban" ? account?.label ?? null : null,
      round: guest.round,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
    };
    setBusy(true);
    mutate((d) =>
      setStatus(
        {
          ...d,
          payments: [...d.payments, temp],
          guests: d.guests.map((g) =>
            g.id === guest.id
              ? { ...g, pendingMethod: null, pendingAccountId: null, pendingAccountLabel: null }
              : g,
          ),
        },
        statusAfterPayment(totals.due - value, closing),
      ),
    );
    setAmount("");
    const r = await addTabPayment(
      guest.id,
      parsed,
      method,
      method === "iban" ? (account?.id ?? null) : null,
      closing,
    ).catch(
      (): Result => ({ error: OFFLINE }),
    );
    setBusy(false);
    if (!("payment" in r) || r.error) {
      mutate((d) =>
        setStatus(
          { ...d, payments: d.payments.filter((p) => p.id !== id) },
          previous,
        ),
      );
      notify(r.error || "Ödeme kaydedilemedi.", "error");
      return;
    }
    mutate((d) =>
      setStatus(
        {
          ...d,
          payments: d.payments.map((p) => (p.id === id ? r.payment : p)),
        },
        r.status,
      ),
    );
    notify(
      `${closing ? "Hesap kapatıldı" : "Ödeme alındı"}: ${formatMoney(r.payment.amount)} · ${paymentMethods[method]}${r.payment.accountLabel ? ` · ${r.payment.accountLabel}` : ""}`,
    );
    void refresh();
  };

  // Simple (non-optimistic) actions: run, then refresh.
  const simple = async (
    run: () => Promise<{ error?: string }>,
    done: string,
  ) => {
    setBusy(true);
    const r = await run().catch((): Result => ({ error: OFFLINE }));
    setBusy(false);
    if (r.error) return notify(r.error, "error");
    notify(done);
    await refresh();
  };
  const markPending = () =>
    simple(
      () => markIbanPending(guest.id, account?.id ?? null),
      "Hesap açık bırakıldı · IBAN bekleniyor",
    );
  const unmarkPending = () =>
    simple(() => clearPending(guest.id), "IBAN bekleme kaldırıldı");
  const setDiscount = (percent: number | null) =>
    simple(
      () => setGuestDiscount(guest.id, percent),
      percent === null
        ? "Ayarlardaki kurala dönüldü"
        : percent
          ? `%${percent} indirim · yeni siparişlere`
          : "İndirim kaldırıldı · yeni siparişler indirimsiz",
    );
  const toggleComplimentary = (line: TabLine) =>
    simple(
      () => setLineComplimentary(line.id, !line.complimentary),
      line.complimentary ? "İkram kaldırıldı" : `İkram: ${line.name}`,
    );

  const removePayment = async (payment: TabPayment) => {
    if (
      !window.confirm(
        `${formatMoney(payment.amount)} ${paymentMethods[payment.method]} ödemesi silinsin mi?`,
      )
    )
      return;
    const previous = guest.status;
    mutate((d) =>
      setStatus(
        { ...d, payments: d.payments.filter((p) => p.id !== payment.id) },
        statusAfterPaymentRemoved(previous, totals.due + payment.amount),
      ),
    );
    const r = await deleteTabPayment(payment.id).catch(
      (): Result => ({ error: OFFLINE }),
    );
    if (r.error) {
      mutate((d) =>
        setStatus({ ...d, payments: [...d.payments, payment] }, previous),
      );
      notify(r.error, "error");
      return;
    }
    notify("Ödeme silindi");
    void refresh();
  };

  // "Hesabı kapat": with a balance left, the remaining amount is taken with
  // the chosen method (Nakit / IBAN / POS) and the tab closes; otherwise the
  // tab simply closes.
  const closeTab = async () => {
    if (totals.due > 0) return takePayment(true);
    setBusy(true);
    mutate((d) => setStatus(d, "closed"));
    const r = await closeTabGuest(guest.id).catch(
      (): Result => ({ error: OFFLINE }),
    );
    setBusy(false);
    if (r.error) {
      mutate((d) => setStatus(d, "open"));
      notify(r.error, "error");
      return;
    }
    notify("Hesap kapatıldı");
    void refresh();
  };

  const removeGuest = async () => {
    if (
      lines.length &&
      !window.confirm(
        `${guest.name} hesabında ${lines.length} kalem var. Kalemler ve ödemeler de silinecek. Yine de silinsin mi?`,
      )
    )
      return;
    if (!window.confirm(`${guest.name} silinsin mi? Bu işlem geri alınamaz.`))
      return;
    setBusy(true);
    const r = await deleteTabGuest(guest.id).catch(
      (): Result => ({ error: OFFLINE }),
    );
    setBusy(false);
    if (r.error) return notify(r.error, "error");
    mutate((d) => ({
      ...d,
      guests: d.guests.filter((g) => g.id !== guest.id),
      lines: d.lines.filter((l) => l.guestId !== guest.id),
      payments: d.payments.filter((p) => p.guestId !== guest.id),
    }));
    notify("Misafir silindi");
    onBack();
    void refresh();
  };

  const ibanText = account ? `${account.label} · ${account.iban}` : "";
  const copyIban = async () => {
    try {
      await navigator.clipboard.writeText(ibanText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify("Kopyalanamadı. Metni seçip kopyalayabilirsin.", "error");
    }
  };
  // Guests who pay later get name, balance and IBAN in one message
  // (WhatsApp etc. through the phone's share sheet; clipboard elsewhere).
  const shareBalance = async () => {
    const text = balanceMessage(guest.name, totals.due, ibanText);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Mesaj kopyalandı");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      notify("Paylaşılamadı. IBAN’ı kopyalayıp gönderebilirsin.", "error");
    }
  };

  const open = guest.status === "open";
  return (
    <section className="tab-detail" aria-labelledby="tab-guest-title">
      <button className="tab-back" onClick={onBack}>
        ← Hesaplar
      </button>
      <div className="tab-detail-head">
        <h1 id="tab-guest-title" className="tab-title">
          {guest.name}
          {guest.round > 1 && (
            <small className="tab-round-badge">{guest.round}. hesap</small>
          )}
        </h1>
        <span className={`ad-badge ${open ? "pending" : "done"}`}>
          {open ? "Açık" : "Kapalı"}
        </span>
      </div>
      {(guest.pendingMethod || guest.discountPercent > 0) && (
        <p className="tab-flags">
          {guest.pendingMethod === "iban" && (
            <span className="tab-flag iban">
              IBAN bekleniyor
              {guest.pendingAccountLabel && ` · ${guest.pendingAccountLabel}`}
            </span>
          )}
          {guest.discountPercent > 0 && (
            <span className="tab-flag discount">
              %{guest.discountPercent} indirim
              {guest.discountSource === "rule" && " · kural"}
            </span>
          )}
        </p>
      )}
      <div className="tab-totals">
        <div>
          <span>Toplam</span>
          <strong>{formatMoney(totals.total)}</strong>
          {(totals.discount > 0 || totals.complimentary > 0) && (
            <small>
              {totals.discount > 0 && `−${formatMoney(totals.discount)} indirim`}
              {totals.discount > 0 && totals.complimentary > 0 && " · "}
              {totals.complimentary > 0 &&
                `${formatMoney(totals.complimentary)} ikram`}
            </small>
          )}
        </div>
        <div>
          <span>Ödenen</span>
          <strong>{formatMoney(totals.paid)}</strong>
        </div>
        <div className={totals.due > 0 ? "owe" : "zero"}>
          <span>Kalan</span>
          <strong>{formatMoney(totals.due)}</strong>
        </div>
      </div>

      <section className="tab-card" aria-labelledby="tab-add-title">
        <div className="tab-card-head">
          <h2 id="tab-add-title">Ekle</h2>
          <div className="tab-chips" role="group" aria-label="Menü kapsamı">
            <button
              className="tab-chip"
              aria-pressed={!allMenu}
              onClick={() => setAllMenu(false)}
            >
              {stations[station]}
            </button>
            <button
              className="tab-chip"
              aria-pressed={allMenu}
              onClick={() => setAllMenu(true)}
            >
              Tüm menü
            </button>
          </div>
        </div>
        {menu.length ? (
          <div className="tab-menu">
            {menu.map((item) => (
              <button
                key={item.id}
                className="tab-menu-item"
                onClick={() => void addItem(item)}
              >
                <span>{item.name}</span>
                <small>
                  {formatMoney(item.price)}
                  {allMenu && ` · ${stations[item.station]}`}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <p className="ad-note">
            Bu istasyon için aktif ürün yok. Yönetici Ayarlar → Menü’den
            ekleyebilir.
          </p>
        )}
      </section>

      <section className="tab-card" aria-labelledby="tab-lines-title">
        <h2 id="tab-lines-title">Alınanlar</h2>
        {lines.length ? (
          <ul className="tab-lines">
            {lines.map((line) => (
              <li
                key={line.id}
                className={`${isTemp(line.id) ? "pending" : ""} ${line.complimentary ? "comp" : ""}`}
              >
                <span className="tab-line-main">
                  <span className="tab-line-name">
                    {line.name}
                    {line.qty > 1 && ` ×${line.qty}`}
                    {line.complimentary && (
                      <span className="tab-flag comp">İkram</span>
                    )}
                  </span>
                  <span className="tab-line-sub">
                    {stations[line.station]} · {formatTime(line.createdAt)}
                    {line.createdByName && ` · ${line.createdByName}`}
                  </span>
                </span>
                <span className="tab-line-amount">
                  {line.complimentary ? (
                    <>
                      <s>{formatMoney(line.price * line.qty)}</s> 0 ₺
                    </>
                  ) : (
                    formatMoney(line.price * line.qty)
                  )}
                </span>
                {canDeleteRecord(user, line) && (
                  <>
                    <button
                      className="tab-x tab-gift"
                      aria-label={
                        line.complimentary
                          ? `${line.name} ikramını kaldır`
                          : `${line.name} ikram et`
                      }
                      aria-pressed={line.complimentary}
                      disabled={isTemp(line.id) || busy}
                      onClick={() => void toggleComplimentary(line)}
                    >
                      🎁
                    </button>
                    <button
                      className="tab-x"
                      aria-label={`${line.name} sil`}
                      disabled={isTemp(line.id)}
                      onClick={() => void removeLine(line)}
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ad-note">Henüz bir şey eklenmedi.</p>
        )}
      </section>

      <section className="tab-card" aria-labelledby="tab-pay-title">
        <h2 id="tab-pay-title">Ödeme</h2>
        {payments.length > 0 && (
          <ul className="tab-lines tab-payments">
            {payments.map((p) => (
              <li key={p.id} className={isTemp(p.id) ? "pending" : ""}>
                <span className="tab-line-main">
                  <span className="tab-line-name">
                    {paymentMethods[p.method]}
                    {p.accountLabel && ` · ${p.accountLabel}`}
                  </span>
                  <span className="tab-line-sub">
                    {formatTime(p.createdAt)}
                    {p.createdByName && ` · ${p.createdByName}`}
                  </span>
                </span>
                <span className="tab-line-amount">{formatMoney(p.amount)}</span>
                {canDeleteRecord(user, p) && (
                  <button
                    className="tab-x"
                    aria-label={`${formatMoney(p.amount)} ödemesini sil`}
                    disabled={isTemp(p.id)}
                    onClick={() => void removePayment(p)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          className="tab-pay-form"
          onSubmit={(e) => {
            e.preventDefault();
            void takePayment();
          }}
        >
          <div className="tab-row">
            <label className="tab-visually-hidden" htmlFor="tab-pay-amount">
              Tutar
            </label>
            <input
              id="tab-pay-amount"
              inputMode="decimal"
              autoComplete="off"
              placeholder={`Tutar (kalan ${formatMoney(totals.due)})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={submitOnEnter}
            />
            <div className="tab-chips" role="group" aria-label="Ödeme yöntemi">
              {(Object.keys(paymentMethods) as PaymentMethod[]).map((m) => (
                <button
                  type="button"
                  key={m}
                  className="tab-chip"
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                >
                  {paymentMethods[m]}
                </button>
              ))}
            </div>
          </div>
          {method === "iban" && activeAccounts.length > 1 && (
            <div className="tab-chips" role="group" aria-label="Hangi IBAN">
              {activeAccounts.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className="tab-chip"
                  aria-pressed={account?.id === a.id}
                  onClick={() => setChosenAccount(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <div className="tab-row">
            <button className="ad-primary" disabled={busy}>
              Ödeme al · açık kalsın
            </button>
            <button
              type="button"
              className="tab-secondary"
              disabled={busy || !open}
              onClick={() => void closeTab()}
            >
              {open
                ? totals.due > 0
                  ? `Hesabı kapat · ${formatMoney(totals.due)}`
                  : "Hesabı kapat"
                : "Kapalı"}
            </button>
          </div>
          {method === "iban" && open && totals.due > 0 && (
            <button
              type="button"
              className="tab-secondary"
              disabled={busy || guest.pendingMethod === "iban"}
              onClick={() => void markPending()}
            >
              {guest.pendingMethod === "iban"
                ? "IBAN bekleniyor · açık"
                : "IBAN ile ödeyecek · açık bırak"}
            </button>
          )}
          {guest.pendingMethod === "iban" && (
            <p className="tab-pending-note">
              Misafir IBAN ile ödeyecek; para gelince “Ödeme al” ile kaydet.{" "}
              <button type="button" onClick={() => void unmarkPending()} disabled={busy}>
                Beklemeyi kaldır
              </button>
            </p>
          )}
          <p className="ad-note">
            “Ödeme al” yazılan tutarı, boşsa kalanın tamamını alır; hesap açık
            kalır, misafir sipariş vermeye devam edebilir. “Hesabı kapat” kalanı
            seçili yöntemle alır ve hesabı kapatır.
          </p>
        </form>
        {method === "iban" && (
          <div className="tab-iban">
            <span>Misafire göster{account ? ` · ${account.label}` : ""}</span>
            {account ? (
              <>
                <p className="tab-iban-text">{account.iban}</p>
                <div className="tab-row">
                  <button
                    type="button"
                    className="tab-secondary"
                    onClick={copyIban}
                  >
                    {copied ? "Kopyalandı ✓" : "IBAN’ı kopyala"}
                  </button>
                  <button
                    type="button"
                    className="tab-secondary"
                    onClick={() => void shareBalance()}
                  >
                    Kalan + IBAN gönder
                  </button>
                </div>
              </>
            ) : (
              <p className="ad-note">
                IBAN henüz girilmedi. Yönetici Ayarlar’dan ekleyebilir.
              </p>
            )}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="tab-card tab-history" aria-labelledby="tab-history-title">
          <h2 id="tab-history-title">Geçmiş hesaplar</h2>
          <p className="ad-note">
            Bu misafirin daha önce kapatılmış hesapları. Değiştirilemez; Özet
            ve CSV’ye dahildir.
          </p>
          {history.map((h) => (
            <details key={h.round} className="tab-round">
              <summary>
                <span>
                  <strong>{h.round}. hesap</strong>
                  {h.from && (
                    <small>
                      {" "}
                      · {formatTime(h.from)}
                      {h.to && h.to !== h.from && `–${formatTime(h.to)}`}
                    </small>
                  )}
                </span>
                <span className="tab-round-sum">
                  {formatMoney(h.totals.total)} ·{" "}
                  {h.payments.length
                    ? [...new Set(h.payments.map((p) => paymentMethods[p.method] + (p.accountLabel ? ` ${p.accountLabel}` : "")))].join(", ")
                    : "ödeme yok"}
                </span>
              </summary>
              <ul className="tab-lines">
                {h.lines.map((line) => (
                  <li key={line.id} className={line.complimentary ? "comp" : ""}>
                    <span className="tab-line-main">
                      <span className="tab-line-name">
                        {line.name}
                        {line.qty > 1 && ` ×${line.qty}`}
                        {line.complimentary && <span className="tab-flag comp">İkram</span>}
                        {line.discountPercent > 0 && !line.complimentary && (
                          <span className="tab-flag discount">%{line.discountPercent}</span>
                        )}
                      </span>
                      <span className="tab-line-sub">
                        {stations[line.station]} · {formatTime(line.createdAt)}
                      </span>
                    </span>
                    <span className="tab-line-amount">
                      {formatMoney(line.complimentary ? 0 : line.price * line.qty)}
                    </span>
                  </li>
                ))}
                {h.payments.map((p) => (
                  <li key={p.id} className="tab-round-payment">
                    <span className="tab-line-main">
                      <span className="tab-line-name">
                        Ödeme · {paymentMethods[p.method]}
                        {p.accountLabel && ` · ${p.accountLabel}`}
                      </span>
                      <span className="tab-line-sub">{formatTime(p.createdAt)}</span>
                    </span>
                    <span className="tab-line-amount">{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
              {(h.totals.discount > 0 || h.totals.complimentary > 0) && (
                <p className="ad-note">
                  {h.totals.discount > 0 && `−${formatMoney(h.totals.discount)} indirim`}
                  {h.totals.discount > 0 && h.totals.complimentary > 0 && " · "}
                  {h.totals.complimentary > 0 && `${formatMoney(h.totals.complimentary)} ikram`}
                </p>
              )}
            </details>
          ))}
        </section>
      )}
      {isAdmin && (
        <section className="tab-card" aria-labelledby="tab-discount-title">
          <h2 id="tab-discount-title">İndirim</h2>
          <p className="tab-discount-state">
            {guest.discountPercent > 0
              ? `Şu an %${guest.discountPercent} · ${guest.discountSource === "override" ? "kişiye özel" : "Ayarlar’daki kural"}`
              : guest.discountSource === "override"
                ? "İndirim kaldırıldı (kural olsa da uygulanmaz)"
                : "İndirim yok"}
          </p>
          <p className="ad-note">
            Yeni siparişlere uygulanır; hesaptaki önceki kalemler eklendikleri
            andaki indirimle kalır. Ekip / misafir kuralları Ayarlar’da.
          </p>
          <form
            className="tab-row"
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(discountInput.replace(",", "."));
              if (!Number.isInteger(value) || value < 0 || value > 100)
                return notify("0–100 arasında bir yüzde yaz.", "error");
              setDiscountInput("");
              void setDiscount(value);
            }}
          >
            <label className="tab-visually-hidden" htmlFor="tab-discount-input">
              İndirim yüzdesi
            </label>
            <input
              id="tab-discount-input"
              inputMode="numeric"
              placeholder="Yüzde, örn. 35"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
            />
            <button className="ad-primary" disabled={busy}>
              Kişiye özel uygula
            </button>
          </form>
          <div className="tab-row">
            <button
              type="button"
              className="tab-secondary"
              disabled={busy || (guest.discountOverride === 0)}
              onClick={() => void setDiscount(0)}
            >
              İndirimi kaldır
            </button>
            <button
              type="button"
              className="tab-secondary"
              disabled={busy || guest.discountOverride === null}
              onClick={() => void setDiscount(null)}
            >
              Kurala dön
            </button>
          </div>
        </section>
      )}
      {isAdmin && (
        <button
          className="tab-danger"
          disabled={busy}
          onClick={() => void removeGuest()}
        >
          Misafiri sil
        </button>
      )}
    </section>
  );
}
