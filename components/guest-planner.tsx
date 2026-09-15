"use client";
import {
  GuestLanguageSwitch,
  useGuestLanguage,
} from "@/components/guest-language";

import { conflictingWorkshop } from "@/lib/guest/fortune";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  MapPin,
  Sparkles,
  Heart,
  Ticket,
  Clock,
  Ship,
  Navigation,
  HelpCircle,
  Users,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import {
  getAvailability,
  logoutGuest,
  saveGuestPlan,
} from "@/app/misafir/actions";
import {
  arrivals,
  diets,
  transports,
  type GuestData,
  type GuestPlan,
} from "@/lib/guest/types";
import { Button } from "@/components/ui/button";

const steps = ["Yolculuğun", "Atölyelerin", "Sana özel", "Son bir bakış"];
const workshops = [
  {
    id: "sound",
    title: "Kolektif Ses",
    host: "Dr. Oğuz Öner",
    time: "15:00–16:15",
    image: "w2",
    desc: "Önce adayı dinle. Sonra kendi sesini kat.",
  },
  {
    id: "scent",
    title: "Koku Laboratuvarı",
    host: "Şeyma Çavdur",
    time: "16:30–18:00",
    image: "w3",
    desc: "Koku hafızandan, sana ait bir parfüme.",
  },
  {
    id: "style",
    title: "Stil İçgüdüdür",
    host: "Deniz Mısır",
    time: "18:00–19:00",
    image: "w5",
    desc: "Renkler, dokular ve seni sen yapan seçimler.",
  },
];

const transportDetails: Record<string, { sub: string; icon: LucideIcon }> = {
  "Vapur / motor": { sub: "Büyükada İskelesi’ne", icon: Ship },
  "Özel deniz taksi": {
    sub: "Evin iskelesine · talep oluştur",
    icon: Sparkles,
  },
  "İBB Deniz Taksi": { sub: "Büyükada İskelesi’ne", icon: Navigation },
  "Henüz belli değil": { sub: "Sonra karar verebilirim", icon: HelpCircle },
};
const transportOptions = transports.map((title) => ({
  title,
  ...transportDetails[title],
}));

export function GuestPlanner({ initial }: { initial: GuestData }) {
  const { language, t } = useGuestLanguage();
  const saved = initial.plan;
  const [availability, setAvailability] = useState(initial.availability);
  const slots = availability
    .filter((a) => a.id.startsWith("fortune-"))
    .map((a) => a.id.slice(8))
    .sort();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible")
        getAvailability()
          .then(setAvailability)
          .catch(() => {});
    };
    const timer = setInterval(poll, 20000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<GuestPlan>(
    saved ?? {
      transport: "",
      origin: "",
      arrival: "",
      party: "1",
      selected: [],
      slot: "",
      allergy: "",
      allergyNote: "",
      diet: diets[0],
      note: "",
      consent: false,
    },
  );
  const {
    transport,
    origin,
    arrival,
    party,
    selected,
    slot,
    allergy,
    allergyNote,
    diet,
    note,
    consent,
  } = plan;
  const update = (patch: Partial<GuestPlan>) =>
    setPlan((p) => ({ ...p, ...patch }));
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  function move(n: number) {
    setStep(n);
    setError("");
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
      heading.current?.focus({ preventScroll: true });
    }, 0);
  }
  async function next() {
    if (step === 0 && !transport)
      return setError("Nasıl gelmeyi düşündüğünü seçebilir misin?");
    if (step === 2 && (!allergy || (allergy === "Var" && !allergyNote.trim())))
      return setError("Hazırlık yapabilmemiz için alerji bilgisini tamamla.");
    if (step === 3) {
      setBusy(true);
      setError("");
      try {
        const result = await saveGuestPlan(plan);
        if (result.error) {
          setError(result.error);
          setAvailability(await getAvailability());
          return;
        }
        getAvailability()
          .then(setAvailability)
          .catch(() => {});
        setDone(true);
        window.scrollTo({ top: 0, behavior: "instant" });
      } catch {
        setError(
          "Bağlantı kurulamadı. Seçimlerin burada duruyor; tekrar deneyebilirsin.",
        );
      } finally {
        setBusy(false);
      }
    } else move(step + 1);
  }
  function toggle(id: string) {
    setError("");
    if (slot && conflictingWorkshop([id], slot) && !selected.includes(id))
      return setError(
        "Bu atölye Fortune Dome saatinle çakışıyor. Önce başka bir saat seçebilirsin.",
      );
    update({
      selected: selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    });
  }
  const active = workshops.filter((w) => selected.includes(w.id));
  return (
    <div className="gp" lang={language} data-step={step}>
      <header className="gp-header">
        <Link href="/" className="gp-brand">
          <Image
            src="/assets/brand-mark.png"
            alt=""
            loading="eager"
            width={32}
            height={40}
          />
          <span>Soul Collective</span>
        </Link>
        <div className="gp-header-actions">
          <GuestLanguageSwitch />
          <form action={logoutGuest}>
            <button className="gp-signout">{t("Çıkış yap ↗")}</button>
          </form>
        </div>
      </header>
      <div className="gp-shell">
        <aside className="gp-aside">
          <div className="gp-art-label">
            <span>SOUL COLLECTIVE</span>
            <span>19.09.2026</span>
          </div>
          <div className="gp-photo">
            <Image
              src="/assets/web/house-1.webp"
              alt={t("Büyükada’da gün batımı ve bahçe")}
              fill
              sizes="(max-width: 850px) 100vw, 400px"
              priority
            />
            <div className="gp-photo-copy">
              <span>{t("19 EYLÜL / BÜYÜKADA")}</span>
              <h2>
                {t("Birlikte güzel")}
                <br />
                <em>{t("bir gün.")}</em>
              </h2>
              <p>One Day on an Island</p>
            </div>
          </div>
          <div className="gp-art-caption">
            <span>
              {t("Merakına yer aç.")}
              <br />
              {t("Kendi hızında katıl.")}
            </span>
            <span aria-hidden="true">↗</span>
          </div>
          <div className="gp-event">
            <span>
              <MapPin size={15} /> {t("Büyükada, İstanbul")}
            </span>
            <span>
              <Clock size={15} /> {t("19 Eylül 2026 · Cumartesi")}
            </span>
          </div>
          <div className="gp-pass">
            <Ticket size={24} />
            <div>
              <strong>Island Pass</strong>
              <p>{t("30 kişi. Bir ev. Birlikte bir gün.")}</p>
            </div>
          </div>
          <p className="gp-demo">
            {initial.isDemo
              ? t(
                  "Tasarım deneme hesabı. Gerçek yer ayırmaz; lütfen örnek bilgiler kullan.",
                )
              : t(
                  "Seçimlerin, son adımda kaydettiğinde onaylanır. Daha sonra kodunla yeniden giriş yapıp değiştirebilirsin.",
                )}
          </p>
        </aside>
        <main className="gp-main">
          {!done ? (
            <>
              <nav className="gp-progress" aria-label={t("Planlama adımları")}>
                {steps.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => i < step && move(i)}
                    disabled={i > step}
                    aria-current={i === step ? "step" : undefined}
                  >
                    <span className={i <= step ? "active" : ""}>
                      {i < step ? <Check size={14} /> : `0${i + 1}`}
                    </span>
                    <small>{t(s)}</small>
                  </button>
                ))}
              </nav>
              <div className="gp-step-scene" key={step}>
                <div className="gp-heading">
                  <span className="gp-eyebrow">
                    {t("SANA ÖZEL BİR GÜN · 0")}
                    {step + 1} / 04
                  </span>
                  <h1 ref={heading} tabIndex={-1}>
                    {t(
                      [
                        "Yolculuğun nasıl başlıyor?",
                        "Merakının peşinden git.",
                        "Biraz da senden konuşalım.",
                        "Planına son bir bakış.",
                      ][step],
                    )}
                  </h1>
                  <p>
                    {t(
                      [
                        "Birkaç küçük detay, birlikte daha rahat bir gün. Yaklaşık 2 dakikanı alır.",
                        "Saatlere göz at, sana iyi gelecek deneyimleri seç. Hepsine yetişmek zorunda değilsin.",
                        "Seni rahat ettirecek küçük detayları önceden bilelim.",
                        "Her şey içine sindi mi? İstediğin bölüme dönüp değişiklik yapabilirsin.",
                      ][step],
                    )}
                  </p>
                </div>
                {step === 0 && (
                  <div className="gp-fields">
                    <fieldset>
                      <legend>{t("Nasıl gelmeyi düşünüyorsun?")}</legend>
                      <div className="gp-transport">
                        {transportOptions.map(({ title, sub, icon: Icon }) => (
                          <button
                            key={title}
                            aria-pressed={transport === title}
                            className={transport === title ? "chosen" : ""}
                            onClick={() => {
                              update({ transport: title });
                              setError("");
                            }}
                          >
                            <Icon size={22} />
                            <strong>{t(title)}</strong>
                            <small>{t(sub)}</small>
                            <span className="gp-radio">
                              {transport === title && <Check size={11} />}
                            </span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {transport && transport !== "Henüz belli değil" && (
                      <div className="gp-hint">
                        {transport === "Özel deniz taksi" ? (
                          t(
                            "Grubunuz için doğrudan evin iskelesine ulaşım ayarlayabiliriz. Bu bir talep; ayrıntıları sizinle ayrıca netleştireceğiz.",
                          )
                        ) : (
                          <>
                            {t(
                              "Büyükada İskelesi’nden eve ulaşımını kendin planlamalısın.",
                            )}{" "}
                            {transport === "Vapur / motor" && (
                              <a
                                href="https://www.adalar.ahmetmogut.com/"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t("Sefer saatlerine bak ↗")}
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    <div className="gp-two">
                      <label>
                        {t("Nereden hareket edeceksin?")}
                        <input
                          value={origin}
                          onChange={(e) => update({ origin: e.target.value })}
                          placeholder={t("Örn. Kadıköy, Beşiktaş…")}
                        />
                      </label>
                      <label>
                        {t("Tahmini varış saatin")}
                        <select
                          value={arrival}
                          onChange={(e) => update({ arrival: e.target.value })}
                        >
                          <option value="">{t("Henüz belli değil")}</option>
                          {arrivals.map((value) => (
                            <option key={value} value={value}>
                              {t(value)}
                            </option>
                          ))}
                        </select>
                        <small>
                          {transport === "Özel deniz taksi"
                            ? t("Evin iskelesine varış")
                            : t("Büyükada İskelesi’ne varış")}
                        </small>
                      </label>
                    </div>
                    <label className="gp-party">
                      <Users size={19} />
                      <span>
                        {t("Kaç kişi birlikte geliyorsunuz?")}
                        <small>
                          {t("Atölye seçimleri yalnızca senin için.")}
                        </small>
                      </span>
                      <select
                        aria-label={t("Birlikte gelen kişi sayısı")}
                        value={party}
                        onChange={(e) => update({ party: e.target.value })}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <option key={n} value={n}>
                            {n === 1
                              ? t("Tek geliyorum")
                              : language === "en"
                                ? `${n} people`
                                : `${n} kişiyiz`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {step === 1 && (
                  <div className="gp-workshops">
                    {workshops.map((w) => {
                      const a = availability.find((a) => a.id === w.id);
                      const available =
                        a?.remaining === null
                          ? null
                          : (a?.remaining ?? 0) + (a?.owned ? 1 : 0);
                      return (
                        <button
                          key={w.id}
                          disabled={
                            !a?.enabled ||
                            (available === 0 && !selected.includes(w.id))
                          }
                          className={`gp-workshop ${selected.includes(w.id) ? "chosen" : ""}`}
                          aria-pressed={selected.includes(w.id)}
                          onClick={() => toggle(w.id)}
                        >
                          <Image
                            src={`/assets/web/${w.image}.webp`}
                            alt=""
                            loading="eager"
                            width={90}
                            height={100}
                          />
                          <div>
                            <span className="gp-time">
                              {w.time}{" "}
                              <span
                                className={
                                  available !== null && available <= 2
                                    ? "gp-low"
                                    : ""
                                }
                              >
                                {!a?.enabled
                                  ? t("Yakında açılacak")
                                  : available === null
                                    ? t("Açık katılım")
                                    : language === "en"
                                      ? `${available} places available · ${a?.capacity} total`
                                      : `${available} yer müsait · ${a?.capacity} kişilik`}
                              </span>
                            </span>
                            <h2>{t(w.title)}</h2>
                            <p>{w.host}</p>
                            <small>{t(w.desc)}</small>
                          </div>
                          <span className="gp-radio">
                            {selected.includes(w.id) && <Check size={12} />}
                          </span>
                        </button>
                      );
                    })}
                    <div className="gp-fortune">
                      <div>
                        <Sparkles size={20} />
                        <span>
                          <h2>Fortune Dome</h2>
                          <p>{t("Bahçede, yalnızca sana ait 15 dakika.")}</p>
                        </span>
                      </div>
                      <div className="gp-slots">
                        {slots.map((time) => {
                          const a = availability.find(
                            (a) => a.id === `fortune-${time}`,
                          );
                          const full = a?.remaining === 0 && !a?.owned;
                          return (
                            <button
                              key={time}
                              disabled={
                                !a?.enabled ||
                                full ||
                                !!conflictingWorkshop(selected, time)
                              }
                              aria-pressed={slot === time}
                              onClick={() =>
                                update({ slot: slot === time ? "" : time })
                              }
                              className={slot === time ? "chosen" : ""}
                            >
                              {time}
                              {
                                <small>
                                  {!a?.enabled
                                    ? t("Kapalı")
                                    : full
                                      ? t("Dolu")
                                      : conflictingWorkshop(selected, time)
                                        ? t("Saat çakışıyor")
                                        : a?.owned
                                          ? t("Senin yerin")
                                          : t("Müsait")}
                                </small>
                              }
                            </button>
                          );
                        })}
                      </div>
                      <small>
                        {t(
                          "Her saat 1 kişilik. Yerler planını kaydettiğinde ayrılır.",
                        )}
                      </small>
                      <p>
                        {t(
                          "Seçtiğin atölyelerle çakışan saatler ayrıca belirtilir.",
                        )}
                      </p>
                    </div>
                    <div className="gp-hint">
                      <strong>{t("Gün boyunca, kendi hızında")}</strong>
                      <p>{t("Doğal Boyama & Serbest Resim")}</p>
                      <small>
                        {t(
                          "Açık stüdyolara dilediğinde uğra; seçim yapman gerekmiyor.",
                        )}
                      </small>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="gp-fields">
                    <fieldset>
                      <legend>
                        {t("Yiyecek alerjin veya intoleransın var mı?")}
                      </legend>
                      <div className="gp-pills">
                        {["Yok", "Var"].map((v) => (
                          <button
                            key={v}
                            aria-pressed={allergy === v}
                            className={allergy === v ? "chosen" : ""}
                            onClick={() => update({ allergy: v })}
                          >
                            {t(v)}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {allergy === "Var" && (
                      <label>
                        {t("Bilmemiz gerekenleri yaz")}
                        <textarea
                          value={allergyNote}
                          onChange={(e) =>
                            update({ allergyNote: e.target.value })
                          }
                          placeholder={t(
                            "Örn. yer fıstığı alerjisi, gluten intoleransı…",
                          )}
                        />
                      </label>
                    )}
                    <label>
                      {t("Beslenme tercihin")}
                      <select
                        value={diet}
                        onChange={(e) => update({ diet: e.target.value })}
                      >
                        {diets.map((d) => (
                          <option key={d} value={d}>
                            {t(d)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("Gününü daha rahat kılmak için…")}{" "}
                      <small>{t("İsteğe bağlı")}</small>
                      <textarea
                        value={note}
                        onChange={(e) => update({ note: e.target.value })}
                        placeholder={t(
                          "Erişim ihtiyacın veya paylaşmak istediğin başka bir detay…",
                        )}
                      />
                    </label>
                    <div className="gp-hint">
                      <Heart size={18} />
                      <p>
                        {t(
                          "Biletinde kişi başı 1 bun sandviç, özel Japon tatlıları ve alkollü veya alkolsüz 2 içecek var.",
                        )}
                      </p>
                    </div>
                    <p className="gp-demo">
                      {t(
                        "Bu bilgiler yalnızca etkinlik hazırlığı için organizasyon ekibiyle paylaşılır. İhtiyaçlarını karşılayabilmek için gerekirse seninle iletişime geçeriz.",
                      )}
                    </p>
                  </div>
                )}
                {step === 3 && (
                  <div className="gp-review">
                    {[
                      {
                        title: t("Yolculuğun"),
                        step: 0,
                        body: (
                          <>
                            <strong>{t(transport)}</strong>
                            <p>
                              {origin || t("Hareket noktası henüz belli değil")}{" "}
                              · {t(arrival) || t("Saat henüz belli değil")}
                            </p>
                            <p>
                              {party}{" "}
                              {language === "en" && party === "1"
                                ? "person travelling"
                                : t("kişi birlikte")}
                              {transport === "Özel deniz taksi"
                                ? t(" · Talep olarak iletilecek")
                                : ""}
                            </p>
                          </>
                        ),
                      },
                      {
                        title: t("Atölyelerin"),
                        step: 1,
                        body: (
                          <>
                            {active.map((w) => (
                              <p key={w.id}>
                                <strong>{t(w.title)}</strong>
                                <br />
                                {w.time}
                              </p>
                            ))}
                            {slot && (
                              <p>
                                <strong>Fortune Dome</strong>
                                <br />
                                {slot} {t("· 15 dakika")}
                              </p>
                            )}
                            {!active.length && !slot && (
                              <p>{t("Henüz saatli bir atölye seçmedin.")}</p>
                            )}
                            <small>
                              {t("Açık stüdyolara gün boyunca uğrayabilirsin.")}
                            </small>
                          </>
                        ),
                      },
                      {
                        title: t("Sana özel"),
                        step: 2,
                        body: (
                          <>
                            <p>
                              {t("Alerji / intolerans:")}{" "}
                              {allergy === "Var" ? allergyNote : t("Yok")}
                            </p>
                            <p>{t(diet)}</p>
                            {note && <p>{note}</p>}
                          </>
                        ),
                      },
                    ].map((s) => (
                      <section key={s.title}>
                        <div>
                          <h2>{s.title}</h2>
                          <button
                            onClick={() => move(s.step)}
                            aria-label={
                              language === "en"
                                ? `Edit ${s.title}`
                                : `${s.title} bölümünü düzenle`
                            }
                          >
                            <Pencil size={14} /> {t("Düzenle")}
                          </button>
                        </div>
                        {s.body}
                      </section>
                    ))}
                    <label className="gp-consent">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => update({ consent: e.target.checked })}
                      />
                      <span>
                        {t(
                          "Ulaşım, atölye ve paylaştığım beslenme / alerji bilgilerimin etkinliği hazırlamak amacıyla Soul Collective ekibi tarafından saklanmasını ve kullanılmasını kabul ediyorum. Bilgilerimi sildirmek için ekibe yazabilirim.",
                        )}
                      </span>
                    </label>
                  </div>
                )}
              </div>
              {error && (
                <p className="gp-error" role="alert">
                  {t(error)}
                </p>
              )}
              <div className="gp-actions">
                {step > 0 ? (
                  <Button variant="ghost" onClick={() => move(step - 1)}>
                    <ArrowLeft size={16} /> {t("Geri")}
                  </Button>
                ) : (
                  <span>
                    {t("Planın değişebilir.")}
                    <br />
                    {t("Sorun değil.")}
                  </span>
                )}
                <Button className="gp-next" disabled={busy} onClick={next}>
                  {busy
                    ? t("Kaydediliyor…")
                    : step === 3
                      ? t("Planımı kaydet")
                      : t("Devam et")}
                  <ArrowRight size={17} />
                </Button>
              </div>
            </>
          ) : (
            <div className="gp-success">
              <div className="gp-success-icon">
                <Check size={32} />
              </div>
              <span className="gp-eyebrow">
                {initial.isDemo
                  ? t("DENEME PLANI KAYDEDİLDİ")
                  : t("PLANIN KAYDEDİLDİ")}
              </span>
              <h1>{t("Görüşmek üzere.")}</h1>
              <p>
                {initial.isDemo
                  ? t(
                      "Deneme planın kaydedildi. Bu hesap gerçek atölye kontenjanı kullanmaz.",
                    )
                  : t(
                      "Seçimlerini kaydettik. Atölye yerlerin ayrıldı; kişisel kodunla yeniden giriş yapıp planını değiştirebilirsin.",
                    )}
              </p>
              <div className="gp-hint">
                <strong>{t("19 Eylül · Büyükada")}</strong>
                <p>
                  {active.length + (slot ? 1 : 0)}{" "}
                  {language === "en" && active.length + (slot ? 1 : 0) === 1
                    ? "experience selected ·"
                    : t("deneyim seçtin ·")}{" "}
                  {t(transport)}
                </p>
              </div>
              <Button
                className="gp-next"
                onClick={() => {
                  setDone(false);
                  move(3);
                }}
              >
                {t("Planıma dön")} <ArrowRight size={16} />
              </Button>
            </div>
          )}
          <footer className="gp-help">
            {t("Aklına bir şey mi takıldı?")}{" "}
            <a href="mailto:collectivebysoul@gmail.com">{t("Bize yaz ↗")}</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
