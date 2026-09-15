"use client";
import { AdminWorkshops } from "@/components/admin-workshops";
import {
  ParticipantControls,
  FortuneEditor,
  FortuneScheduleControls,
} from "@/components/admin-management";
import { AdminSettings } from "@/components/admin-settings";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAdminData, issueGuest, logoutAdmin } from "@/app/yonetim/actions";
import {
  guestCategories,
  type AdminData,
  type AdminGuest,
  type GuestCategory,
} from "@/lib/guest/admin-types";
import { useAction } from "@/hooks/use-action";
const categoryOptions = Object.entries(guestCategories).map(
  ([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ),
);
const workshopNames: Record<string, string> = {
  sound: "Kolektif Ses",
  scent: "Koku Laboratuvarı",
  style: "Stil İçgüdüdür",
};
const date = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const text = (value: string | undefined | null) => value?.trim() || "—";
function Answers({ guest: g }: { guest: AdminGuest }) {
  if (!g.plan)
    return (
      <p>
        Henüz planını kaydetmedi. Kişisel koduyla giriş yapıp formu
        tamamlamasını bekliyoruz.
      </p>
    );
  const p = g.plan;
  const answers = [
    ["Ulaşım", p.transport],
    ["Hareket noktası", p.origin],
    ["Varış saati", p.arrival || "Henüz belli değil"],
    ["Birlikte gelen kişi sayısı", p.party],
    ["Atölyeler", p.selected.map((id) => workshopNames[id] || id).join(", ")],
    ["Fortune Dome", p.slot],
    ["Alerji / intolerans", p.allergy],
    ["Alerji açıklaması", p.allergyNote],
    ["Beslenme tercihi", p.diet],
    ["Özel ihtiyaçlar ve notlar", p.note],
    ["Bilgi paylaşım onayı", p.consent ? "Onaylandı" : "Onaylanmadı"],
    ["Son kayıt", g.updatedAt ? date(g.updatedAt) : ""],
  ];
  return (
    <dl className="ad-answers">
      {answers.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{text(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function AdminPanel({ initial }: { initial: AdminData }) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [category, setCategory] = useState<GuestCategory>("paid");
  const [showRemoved, setShowRemoved] = useState(false);
  const [settings, setSettings] = useState(false);
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showDemo, setShowDemo] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [paid, setPaid] = useState(false);
  const create = useAction();
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const requestId = useRef("");
  const inFlight = useRef<Promise<void> | null>(null);
  const refresh = useCallback(async () => {
    // A mutation must fetch again after any older polling request has finished.
    while (inFlight.current) await inFlight.current.catch(() => {});
    const request = (async () => {
      setRefreshing(true);
      try {
        setData(await getAdminData());
        setError("");
      } catch {
        setError(
          "Liste güncellenemedi. Son alınan bilgiler gösteriliyor. Bağlantını kontrol et; gerekirse yeniden giriş yap.",
        );
        throw new Error("Liste güncellenemedi.");
      } finally {
        setRefreshing(false);
      }
    })();
    inFlight.current = request;
    try {
      await request;
    } finally {
      inFlight.current = null;
    }
  }, []);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => {});
    };
    const timer = setInterval(visible, 15000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  const real = data.guests.filter((g) => !g.isDemo && g.active);
  const done = real.filter((g) => g.plan).length;
  const rows = data.guests.filter(
    (g) =>
      (categoryFilter === "all" || g.category === categoryFilter) &&
      (showRemoved || g.active) &&
      (showDemo || !g.isDemo) &&
      g.name.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")) &&
      (filter === "all" ||
        (filter === "done" && g.plan) ||
        (filter === "pending" && !g.plan)),
  );
  const fortuneSlots = data.workshops.filter((w) =>
    w.id.startsWith("fortune-"),
  );
  const inviteMessage = issued
    ? `Merhaba ${issued.name},\nGününü planlamak için: https://collectivebysoul.com/misafir\nKişisel giriş kodun: ${issued.code}`
    : "";
  const beginCreate = () => {
    requestId.current = crypto.randomUUID();
    setName("");
    setCategory("paid");
    setPaid(false);
    setIssued(null);
    create.setError("");
    setCopied(false);
    setShowCreate(true);
  };
  return (
    <div className="ad">
      <header className="ad-header">
        <Link href="/" className="ad-brand">
          <Image src="/assets/brand-mark.png" alt="" width={32} height={40} />
          Soul Collective
        </Link>
        <div>
          <button
            aria-expanded={settings}
            aria-controls="account-settings"
            onClick={() => setSettings(!settings)}
          >
            Hesap ayarları
          </button>
          <Link href="/misafir">Misafir ekranı ↗</Link>
          <form action={logoutAdmin}>
            <button>Çıkış yap</button>
          </form>
        </div>
      </header>
      <main className="ad-wrap">
        {settings && <AdminSettings />}
        <div className="ad-title">
          <div>
            <span className="ad-kicker">19 EYLÜL 2026 · YÖNETİM</span>
            <h1>Güne hazır mıyız?</h1>
            <p>Kim geliyor, neye katılıyor? Hepsi burada.</p>
          </div>
          <button className="ad-primary" onClick={beginCreate}>
            + Katılımcı ekle
          </button>
        </div>
        <div className="ad-stats">
          <article>
            <span>Aktif katılımcı</span>
            <strong>{real.length}</strong>
          </article>
          <article>
            <span>Planını tamamladı</span>
            <strong>{done}</strong>
          </article>
          <article>
            <span>Henüz doldurmadı</span>
            <strong>{real.length - done}</strong>
          </article>
          <article>
            <span>Özel deniz taksi talebi</span>
            <strong>
              {
                real.filter((g) => g.plan?.transport === "Özel deniz taksi")
                  .length
              }
            </strong>
          </article>
        </div>
        <div
          className="ad-category-stats"
          aria-label="Katılımcı türüne göre sayılar"
        >
          {Object.entries(guestCategories).map(([id, label]) => (
            <article key={id}>
              <span>{label}</span>
              <strong>{real.filter((g) => g.category === id).length}</strong>
            </article>
          ))}
        </div>
        <p className="ad-note">
          Özet sayılara deneme ve iptal edilmiş kayıtlar dahil değil.
          Kaydedilmemiş taslakları göremeyiz.
        </p>
        {showCreate && (
          <section className="ad-create" aria-labelledby="create-title">
            <div className="ad-section-heading">
              <h2 id="create-title">
                {issued ? "Kişisel kod hazır" : "Yeni katılımcı"}
              </h2>
              <button onClick={() => setShowCreate(false)}>Kapat ×</button>
            </div>
            {issued ? (
              <>
                <p>
                  <strong>{issued.name}</strong> için oluşturuldu. Aşağıdaki
                  mesajı kopyalayıp kendin gönderebilirsin.
                </p>
                <pre>{inviteMessage}</pre>
                <p className="ad-note">
                  Kodu şimdi kopyala; bu ekran kapandıktan sonra tekrar
                  gösterilmez.
                </p>
                <button
                  className="ad-primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteMessage);
                      setCopied(true);
                    } catch {
                      create.setError(
                        "Kopyalanamadı. Yukarıdaki metni seçip kopyalayabilirsin.",
                      );
                    }
                  }}
                >
                  {copied ? "Kopyalandı ✓" : "Mesajı kopyala"}
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void create.run(
                    "Bağlantı kesildi. Aynı formu yeniden deneyebilirsin.",
                    () => issueGuest(name, paid, requestId.current, category),
                    async (r) => {
                      if (r.code && r.name) {
                        setIssued({ name: r.name, code: r.code });
                        await refresh();
                      }
                    },
                  );
                }}
              >
                <label htmlFor="new-guest-name">Ad soyad</label>
                <input
                  id="new-guest-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                />
                <label htmlFor="new-guest-category">Katılımcı türü</label>
                <select
                  id="new-guest-category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as "paid" | "team" | "guest")
                  }
                >
                  {categoryOptions}
                </select>
                {category === "paid" && (
                  <label className="ad-check">
                    <input
                      type="checkbox"
                      checked={paid}
                      onChange={(e) => setPaid(e.target.checked)}
                      required
                    />
                    Bu kişinin bilet ödemesini kontrol ettim ve onaylıyorum.
                  </label>
                )}
                <button className="ad-primary" disabled={create.busy}>
                  {create.busy ? "Oluşturuluyor…" : "Kişisel kod oluştur"}
                </button>
              </form>
            )}
            {create.error && (
              <p className="ad-error" role="alert">
                {create.error}
              </p>
            )}
          </section>
        )}
        <section className="ad-capacity">
          <div className="ad-section-heading">
            <h2>Atölyeler</h2>
            <span>Gerçek rezervasyonlar</span>
          </div>
          <AdminWorkshops
            workshops={data.workshops}
            names={workshopNames}
            refresh={refresh}
          />
          <details className="ad-fortune">
            <summary>Fortune Dome · rezervasyonları düzenle</summary>
            <p className="ad-note">
              Her saat 1 kişilik. Planını doldurmuş kişileri atayabilir,
              rezervasyonları kaldırabilir veya saati kapatabilirsin. Yeni saat
              atamak kişinin önceki çadır saatini serbest bırakır.
            </p>
            <FortuneScheduleControls
              count={fortuneSlots.length}
              refresh={refresh}
            />
            <div className="ad-slot-grid">
              {fortuneSlots.map((w) => (
                <FortuneEditor
                  key={
                    w.id +
                    ":" +
                    w.enabled +
                    ":" +
                    w.guests.map((g) => g.id).join(",")
                  }
                  workshop={w}
                  guests={data.guests}
                  refresh={refresh}
                />
              ))}
            </div>
          </details>
        </section>
        <section className="ad-list">
          <div className="ad-section-heading">
            <h2>Katılımcılar</h2>
            <div className="ad-sync" aria-live="polite">
              <span>
                {refreshing
                  ? "Güncelleniyor…"
                  : `Son güncelleme: ${date(data.fetchedAt)}`}
              </span>
              <button
                onClick={() => void refresh().catch(() => {})}
                disabled={refreshing}
              >
                Yenile ↻
              </button>
            </div>
          </div>
          <p className="ad-note">
            Bu ekran açıkken her 15 saniyede otomatik yenilenir.
          </p>
          {error && (
            <p className="ad-error" role="alert">
              {error} <a href="/yonetim">Girişi kontrol et ↗</a>
            </p>
          )}
          <div className="ad-filters">
            <input
              aria-label="Katılımcı ara"
              type="search"
              placeholder="İsim ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Katılımcı türü filtresi"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Tüm katılımcılar</option>
              {categoryOptions}
            </select>
            <select
              aria-label="Kayıt durumu"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Tüm durumlar</option>
              <option value="done">Tamamlayanlar</option>
              <option value="pending">Henüz doldurmayanlar</option>
            </select>
            <label className="ad-check">
              <input
                type="checkbox"
                checked={showDemo}
                onChange={(e) => setShowDemo(e.target.checked)}
              />
              Denemeleri göster
            </label>
            <label className="ad-check">
              <input
                type="checkbox"
                checked={showRemoved}
                onChange={(e) => setShowRemoved(e.target.checked)}
              />
              Kaldırılanları göster
            </label>
          </div>
          <div
            className="ad-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Katılımcı tablosu, diğer sütunlar için yana kaydır"
          >
            <table>
              <thead>
                <tr>
                  {[
                    "Katılımcı",
                    "Durum",
                    "Ulaşım / hareket",
                    "Varış",
                    "Atölyeler",
                    "Beslenme / alerji",
                    "Son kayıt",
                    "",
                  ].map((h, i) => (
                    <th key={i} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <Fragment key={g.id}>
                    <tr>
                      <th scope="row">
                        {g.name}
                        <small className="ad-demo">
                          {guestCategories[g.category]}
                        </small>
                        {g.isDemo && <small className="ad-demo">Deneme</small>}
                        {!g.active && <small className="ad-demo">İptal</small>}
                      </th>
                      <td>
                        <span
                          className={`ad-badge ${g.plan ? "done" : "pending"}`}
                        >
                          {g.plan ? "Tamamladı" : "Bekleniyor"}
                        </span>
                      </td>
                      <td>
                        {text(g.plan?.transport)}
                        <small>{text(g.plan?.origin)}</small>
                      </td>
                      <td>
                        {g.plan ? g.plan.arrival || "Henüz belli değil" : "—"}
                        {g.plan && <small>{g.plan.party} kişi birlikte</small>}
                      </td>
                      <td>
                        {g.plan?.selected.map((id) => (
                          <small key={id}>{workshopNames[id] || id}</small>
                        ))}
                        {g.plan?.slot && <small>Fortune · {g.plan.slot}</small>}
                        {!g.plan?.selected.length && !g.plan?.slot && "—"}
                      </td>
                      <td>
                        {g.plan?.allergy === "Var" ? (
                          <span className="ad-allergy">
                            {g.plan.allergyNote}
                          </span>
                        ) : g.plan ? (
                          "Alerji yok"
                        ) : (
                          "—"
                        )}
                        <small>{text(g.plan?.diet)}</small>
                      </td>
                      <td>{g.updatedAt ? date(g.updatedAt) : "—"}</td>
                      <td>
                        <button
                          className="ad-detail-button"
                          aria-expanded={expanded === g.id}
                          aria-controls={`answers-${g.id}`}
                          onClick={() =>
                            setExpanded(expanded === g.id ? null : g.id)
                          }
                        >
                          {expanded === g.id ? "Kapat" : "Detaylar"}
                        </button>
                      </td>
                    </tr>
                    {expanded === g.id && (
                      <tr id={`answers-${g.id}`} className="ad-detail-row">
                        <td colSpan={8}>
                          <ParticipantControls guest={g} refresh={refresh} />
                          <Answers guest={g} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <p className="ad-empty">
                {data.guests.length
                  ? "Bu filtreye uygun kayıt yok."
                  : "Henüz biletli eklenmedi. İlk kişiyi “Biletli ekle” ile ekleyebilirsin."}
              </p>
            )}
          </div>
          <p className="ad-note">
            {rows.length} kayıt gösteriliyor. “Bekleniyor”, kodu oluşturulmuş
            ancak planı henüz kaydedilmemiş kişi demektir.
          </p>
        </section>
      </main>
    </div>
  );
}
