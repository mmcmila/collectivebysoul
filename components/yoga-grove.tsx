"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  motion,
  MotionConfig,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Menu,
  Palette,
  Users,
  Wind,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { copy, workshops } from "@/components/event-content";

type Language = keyof typeof copy;
type CopyKey = keyof typeof copy.en;
const navigation = [
  ["day", "gun"],
  ["place", "mekan"],
  ["workshops", "atolyeler"],
  ["music", "muzik"],
  ["tickets", "biletler"],
  ["faq", "sss"],
] as const;
const gallery = [
  [
    "web/house-1.webp",
    "Gün batımında havuz ve bahçe",
    "Pool and garden at sunset",
  ],
  ["web/house-5.webp", "Taş kayıkhane ve iskele", "Stone boathouse and pier"],
  [
    "web/house-3.webp",
    "Palmiye ağaçları önünde havuz",
    "Pool beneath the palm trees",
  ],
  [
    "web/boat.webp",
    "Adaya giden özel teknenin ön güvertesi",
    "Bow of the private boat to the island",
  ],
  ["web/boat_night.webp", "Gece dönüş teknesi", "The return boat at night"],
];

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: reduced ? 0 : 0.65,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
function Label({ children }: { children: ReactNode }) {
  return (
    <Badge variant="secondary" className="section-label">
      <span aria-hidden="true">•</span>
      {children}
    </Badge>
  );
}
function Photo({
  file,
  alt,
  className,
  priority = false,
}: {
  file: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("photo", className)}>
      <Image
        src={`/assets/${file}`}
        alt={alt}
        fill
        sizes={
          priority
            ? "100vw"
            : "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 640px"
        }
        preload={priority}
      />
    </div>
  );
}
function Brand() {
  return (
    <a href="#top" className="brand" aria-label="Soul Collective">
      <Image
        src="/assets/mark.svg"
        alt=""
        width={29}
        height={33}
        className="brand-mark"
      />
      <span>Soul Collective</span>
    </a>
  );
}
function Join({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  return (
    <a
      href="#basvuru"
      className={buttonVariants({
        variant: light ? "secondary" : "default",
        size: "lg",
      })}
    >
      {children}
      <span className="button-arrow">
        <ArrowRight aria-hidden="true" />
      </span>
    </a>
  );
}

export function YogaGrove() {
  const [language, setLanguage] = useState<Language>("tr");
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [draftOpened, setDraftOpened] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const hero = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const { scrollYProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  useMotionValueEvent(scrollY, "change", (value) => setScrolled(value > 70));
  const t = (key: CopyKey) => copy[language][key];
  const en = language === "en";
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `One Day on an Island — ${language === "en" ? "19 September" : "19 Eylül"} 2026, Büyükada`;
  }, [language]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = ["name", "phone", "email", "instagram", "reference", "party"]
      .map((key) => `${t(`form.${key}` as CopyKey)}: ${data.get(key) || "-"}`)
      .join("\n");
    setDraftOpened(true);
    window.location.href = `mailto:hello@soulcollective.co?subject=${encodeURIComponent(en ? "One Day on an Island participation" : "One Day on an Island katılım")}&body=${encodeURIComponent(body)}`;
  }
  function Close() {
    return (
      <DialogClose
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-4 right-4"
          />
        }
        aria-label={en ? "Close dialog" : "Pencereyi kapat"}
      >
        <X />
      </DialogClose>
    );
  }
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        {t("a11y.skip")}
      </a>
      <header
        className={cn(
          "header",
          scrolled && "header-scrolled",
          menuOpen && "header-open",
        )}
      >
        <div className="shell nav-inner">
          <Brand />
          <nav
            aria-label={en ? "Main navigation" : "Ana navigasyon"}
            className="desktop-nav"
          >
            {navigation.map(([key, id]) => (
              <a key={id} href={`#${id}`}>
                {t(`nav.${key}`)}
              </a>
            ))}
          </nav>
          <div className="nav-controls">
            <div
              className="language-switch"
              role="group"
              aria-label={t("a11y.language")}
            >
              {(["tr", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  aria-pressed={language === lang}
                  onClick={() => {
                    setLanguage(lang);
                    setMenuOpen(false);
                  }}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="desktop-join">
              <Join light={!scrolled}>{t("nav.apply")}</Join>
            </div>
            <Button
              ref={menuButton}
              variant="ghost"
              size="icon"
              className="menu-toggle"
              aria-label={
                menuOpen
                  ? en
                    ? "Close menu"
                    : "Menüyü kapat"
                  : en
                    ? "Open menu"
                    : "Menüyü aç"
              }
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="mobile-nav"
            aria-label={en ? "Mobile navigation" : "Mobil navigasyon"}
          >
            {navigation.map(([key, id]) => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
                {t(`nav.${key}`)}
                <ArrowUpRight aria-hidden="true" />
              </a>
            ))}
            <a href="#basvuru" onClick={() => setMenuOpen(false)}>
              {t("nav.apply")}
              <ArrowUpRight aria-hidden="true" />
            </a>
          </nav>
        )}
      </header>
      <main id="main">
        <section id="top" className="hero" ref={hero}>
          <motion.div
            className="hero-image"
            style={{ y: reduced ? 0 : heroY }}
            initial={{ scale: reduced ? 1 : 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          >
            <Photo
              file="web/hero.webp"
              alt={
                en
                  ? "An illustrated doorway opening onto the sea, surrounded by flowers and birds"
                  : "Çiçekler ve kuşlarla çevrili, denize açılan resimli bir kapı"
              }
              priority
            />
          </motion.div>
          <div className="hero-shade" />
          <div className="shell hero-inner">
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: reduced ? 0 : 35 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15 }}
            >
              <p className="eyebrow">● &nbsp; {t("hero.eyebrow")}</p>
              <h1>{t("hero.title")}</h1>
              <p className="hero-description">{t("hero.body")}</p>
              <div className="actions">
                <Join light>{t("hero.primary")}</Join>
                <a
                  href="#akis"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  {t("hero.secondary")}
                </a>
              </div>
              <div className="event-facts">
                {[
                  [t("facts.date"), t("facts.day")],
                  ["12:30 · 13:00", t("facts.departure")],
                  ["50", t("facts.people")],
                  ["00:30", t("facts.return")],
                ].map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>
        <section id="gun" className="section shell tension">
          <Reveal className="section-heading centered">
            <Label>{t("intro.eyebrow")}</Label>
            <h2>{t("intro.title")}</h2>
            <p>{t("intro.body")}</p>
          </Reveal>
          <div className="concerns-grid event-principles">
            {(
              [
                { key: "join", icon: Palette },
                { key: "meet", icon: Users },
                { key: "pace", icon: Wind },
              ] as const
            ).map(({ key, icon: Icon }, i) => (
              <Reveal className="concern" key={key} delay={i * 0.04}>
                <span className="icon-circle">
                  <Icon strokeWidth={1.3} />
                </span>
                <div>
                  <h3>{t(`intro.${key}Title`)}</h3>
                  <p>{t(`intro.${key}Body`)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
        <section id="mekan" className="section shell">
          <div className="about-grid">
            <Reveal>
              <Photo
                file="web/g4.webp"
                alt={
                  en
                    ? "The villa’s garden facing the sea"
                    : "Villanın denize bakan bahçesi"
                }
                className="about-photo"
              />
            </Reveal>
            <Reveal className="about-copy">
              <Label>{t("place.eyebrow")}</Label>
              <h2>{t("place.title")}</h2>
              <p>{t("place.body1")}</p>
              <p>{t("place.body2")}</p>
              <div className="stats">
                {["50", "6", "12"].map((n, i) => (
                  <div key={n}>
                    <strong>{n}</strong>
                    <span>{t(`place.stat${i + 1}` as CopyKey)}</span>
                  </div>
                ))}
              </div>
              <Join>{t("nav.apply")}</Join>
            </Reveal>
          </div>
          <div className="venue-gallery" aria-label={t("gallery.label")}>
            {gallery.map(([file, trAlt, enAlt], i) => (
              <Reveal key={file} delay={i * 0.04}>
                <Dialog>
                  <DialogTrigger
                    className="gallery-button"
                    aria-label={`${en ? "View" : "Görüntüle"}: ${en ? enAlt : trAlt}`}
                  >
                    <Photo file={file} alt={en ? enAlt : trAlt} />
                    <span className="class-arrow">
                      <ArrowUpRight aria-hidden="true" />
                    </span>
                  </DialogTrigger>
                  <DialogContent
                    className="photo-dialog"
                    showCloseButton={false}
                  >
                    <DialogTitle className="sr-only">
                      {en ? enAlt : trAlt}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      {t("gallery.label")}
                    </DialogDescription>
                    <Image
                      src={`/assets/${file}`}
                      alt={en ? enAlt : trAlt}
                      width={1760}
                      height={2200}
                      sizes="(max-width: 760px) 90vw, 800px"
                    />
                    <Close />
                  </DialogContent>
                </Dialog>
              </Reveal>
            ))}
          </div>
        </section>
        <section id="akis" className="section shell method-grid">
          <div className="method-intro">
            <Reveal>
              <Label>{t("flow.eyebrow")}</Label>
              <h2>{t("flow.title")}</h2>
              <p>{t("flow.body")}</p>
              <Join>{t("nav.apply")}</Join>
            </Reveal>
          </div>
          <div className="method-stack">
            {["web/boat.webp", "web/dusk.webp", "web/house-4.webp"].map(
              (file, i) => (
                <motion.article
                  key={file}
                  className="method-card"
                  style={{
                    top: 115 + i * 18,
                    rotate: reduced ? 0 : i === 1 ? 2 : -2,
                  }}
                  initial={{ opacity: 0, y: reduced ? 0 : 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.7 }}
                >
                  <Photo file={file} alt={t(`flow.s${i + 1}t` as CopyKey)} />
                  <div className="method-shade" />
                  <span className="method-number">0{i + 1}</span>
                  <div className="method-caption">
                    <h3>{t(`flow.s${i + 1}t` as CopyKey)}</h3>
                    <p>{t(`flow.s${i + 1}b` as CopyKey)}</p>
                  </div>
                </motion.article>
              ),
            )}
          </div>
        </section>
        <section id="atolyeler" className="section shell">
          <Reveal className="section-heading split-heading">
            <div>
              <Label>{t("workshops.eyebrow")}</Label>
              <h2>{t("workshops.title")}</h2>
              <p>{t("workshops.body")}</p>
            </div>
            <Join>{t("nav.apply")}</Join>
          </Reveal>
          <div className="classes-grid">
            {workshops[language].map((w, i) => (
              <Reveal key={w.i} delay={i * 0.04}>
                <Dialog>
                  <DialogTrigger className="class-card">
                    <div className="class-image">
                      <Photo file={w.i} alt={`${w.t} · ${w.h}`} />
                      <div className="class-badges">
                        <Badge variant="secondary">{w.m}</Badge>
                      </div>
                      <span className="class-arrow">
                        <ArrowUpRight aria-hidden="true" />
                      </span>
                    </div>
                    <h3>{w.t}</h3>
                    <p className="workshop-host">{w.h}</p>
                    <p>{w.s}</p>
                  </DialogTrigger>
                  <DialogContent
                    className="workshop-dialog"
                    showCloseButton={false}
                  >
                    <Photo
                      file={w.i}
                      alt={`${w.t} · ${w.h}`}
                      className="workshop-dialog-photo"
                    />
                    <DialogHeader>
                      <DialogTitle>{w.t}</DialogTitle>
                      <DialogDescription>
                        {w.h} · {w.m}
                      </DialogDescription>
                    </DialogHeader>
                    <p>{w.mm}</p>
                    <p className="article-body">{w.b}</p>
                    <Close />
                  </DialogContent>
                </Dialog>
              </Reveal>
            ))}
          </div>
        </section>
        <section id="ev-sahipleri" className="section shell">
          <Reveal className="section-heading centered">
            <Label>{t("hosts.eyebrow")}</Label>
            <h2>{t("hosts.title")}</h2>
            <p>{t("hosts.body")}</p>
          </Reveal>
          <div className="teachers-grid">
            {[
              ["Dr. Oğuz Öner", "oguz", "web/oguz.webp"],
              ["Şeyma Çavdur", "seyma", "web/seyma.webp"],
              ["Bisou Me", "bisou", "web/w5.webp"],
            ].map(([name, key, file], i) => (
              <Reveal key={key} delay={i * 0.08}>
                <Photo file={file} alt={name} className="teacher-photo" />
                <h3>{name}</h3>
                <p>{t(`hosts.${key}` as CopyKey)}</p>
              </Reveal>
            ))}
          </div>
        </section>
        <section id="muzik" className="benefits section">
          <div className="shell music-grid">
            <Reveal>
              <Label>{t("music.time")}</Label>
              <h2>{t("music.title")}</h2>
              <p>{t("music.tba")}</p>
            </Reveal>
            <Reveal>
              <div className="music-heading">
                <h3>{t("music.djs")}</h3>
                <span>{t("music.order")}</span>
              </div>
              <ol className="music-list" aria-label={t("music.listLabel")}>
                {["Emre Arısev", "Manthem", "Özlem Atalay", "Tugen"].map(
                  (name, i) => (
                    <li key={name}>
                      <span>0{i + 1}</span>
                      {name}
                    </li>
                  ),
                )}
              </ol>
            </Reveal>
          </div>
        </section>
        <section id="biletler" className="section shell">
          <Reveal className="section-heading centered">
            <Label>{t("tickets.eyebrow")}</Label>
            <h2>{t("tickets.title")}</h2>
            <p>{t("tickets.body")}</p>
          </Reveal>
          <Reveal className="price-card price-featured event-ticket">
            <div>
              <Label>{t("tickets.tag")}</Label>
              <h3>The Crossing Pass</h3>
              <p>{t("tickets.intro")}</p>
              <Join light>{t("tickets.cta")}</Join>
            </div>
            <div>
              <h3>{t("tickets.includes")}</h3>
              <ul>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <li key={i}>
                    <Check aria-hidden="true" />
                    {t(`tickets.i${i}` as CopyKey)}
                  </li>
                ))}
              </ul>
              <p>{t("tickets.note")}</p>
            </div>
          </Reveal>
        </section>
        <section id="basvuru" className="section shell application-grid">
          <Reveal className="about-copy">
            <Label>{t("apply.eyebrow")}</Label>
            <h2>{t("apply.title")}</h2>
            <p>{t("apply.body")}</p>
          </Reveal>
          <Reveal>
            <form className="application-form" onSubmit={apply}>
              {(
                ["name", "phone", "email", "instagram", "reference"] as const
              ).map((key) => (
                <div className="field" key={key}>
                  <label htmlFor={key}>{t(`form.${key}`)}</label>
                  <input
                    id={key}
                    name={key}
                    type={
                      key === "email"
                        ? "email"
                        : key === "phone"
                          ? "tel"
                          : "text"
                    }
                    autoComplete={
                      key === "name"
                        ? "name"
                        : key === "email"
                          ? "email"
                          : key === "phone"
                            ? "tel"
                            : undefined
                    }
                    required={["name", "phone", "email"].includes(key)}
                    placeholder={key === "instagram" ? "@" : undefined}
                  />
                </div>
              ))}
              <div className="field">
                <label htmlFor="party">{t("form.party")}</label>
                <select id="party" name="party">
                  {(["one", "two", "three"] as const).map((key, i) => (
                    <option key={key} value={i + 1}>
                      {t(`form.${key}`)}
                    </option>
                  ))}
                </select>
              </div>
              <label className="form-check form-wide" htmlFor="terms">
                <input type="checkbox" id="terms" name="terms" required />
                <span>
                  {t("form.t1")}{" "}
                  <a className="inline-link" href="#sss">
                    {t("form.t2")}
                  </a>{" "}
                  {t("form.t3")}
                </span>
              </label>
              <p className="form-note form-wide">{t("form.note")}</p>
              <Button type="submit" size="lg" className="form-wide">
                {t("form.submit")}
                <ArrowRight />
              </Button>
              <p role="status" className="form-note form-wide">
                {draftOpened
                  ? en
                    ? "Your email draft is opening. Send it to complete your request."
                    : "E-posta taslağın açılıyor. Katılım talebini tamamlamak için e-postayı göndermelisin."
                  : ""}
              </p>
            </form>
          </Reveal>
        </section>
        <section id="sss" className="section shell faq-grid">
          <Reveal>
            <Label>{t("faq.eyebrow")}</Label>
            <h2>{t("faq.title")}</h2>
            <p>
              <a className="inline-link" href="mailto:hello@soulcollective.co">
                hello@soulcollective.co
              </a>
            </p>
          </Reveal>
          <Reveal>
            <Accordion defaultValue={["faq-1"]}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger>
                    {t(`faq.q${i}` as CopyKey)}
                  </AccordionTrigger>
                  <AccordionContent>
                    {t(`faq.a${i}` as CopyKey)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </section>
        <section className="cta">
          <Photo
            file="web/dusk.webp"
            alt={
              en
                ? "Pool and sea view at dusk on Büyükada"
                : "Büyükada’da gün batımında havuz ve deniz"
            }
          />
          <div className="cta-shade" />
          <Reveal className="cta-copy">
            <p className="eyebrow">{t("closing.eyebrow")}</p>
            <h2>{t("closing.title")}</h2>
            <p>{t("closing.body")}</p>
            <Join light>{t("closing.cta")}</Join>
          </Reveal>
        </section>
      </main>
      <footer className="footer">
        <div className="shell">
          <div className="footer-grid">
            <div className="footer-about">
              <Brand />
              <p>{t("footer.about")}</p>
              <a href="https://instagram.com/collectivebysoul">
                @collectivebysoul
              </a>
            </div>
            <div>
              <h4>{t("footer.explore")}</h4>
              {navigation.slice(0, 3).map(([key, id]) => (
                <a key={id} href={`#${id}`}>
                  {t(`nav.${key}`)}
                </a>
              ))}
            </div>
            <div>
              <h4>{t("footer.event")}</h4>
              {navigation.slice(3).map(([key, id]) => (
                <a key={id} href={`#${id}`}>
                  {t(`nav.${key}`)}
                </a>
              ))}
              <a href="#basvuru">{t("nav.apply")}</a>
            </div>
            <div>
              <h4>{t("footer.date")}</h4>
              <p>Büyükada, İstanbul</p>
              <p>
                {t("footer.boat")}
                <br />
                {t("footer.return")}
              </p>
              <a href="mailto:hello@soulcollective.co">
                hello@soulcollective.co
              </a>
            </div>
          </div>
          <div className="footer-wordmark" aria-hidden="true">
            soul collective
          </div>
          <div className="footer-bottom">
            <p>© 2026 Soul Collective</p>
            <span>ONE DAY ON AN ISLAND</span>
          </div>
        </div>
      </footer>
    </MotionConfig>
  );
}
