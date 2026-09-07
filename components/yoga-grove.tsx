"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
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
  BatteryLow,
  Check,
  CloudRain,
  Flower2,
  Heart,
  Leaf,
  Menu,
  Moon,
  MoveUpRight,
  PersonStanding,
  Sofa,
  Sparkles,
  Sun,
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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const classes = [
  {
    name: "Vinyasa Flow",
    image: "vinyasa.jpg",
    frequency: "5x weekly",
    duration: "60 min",
    description:
      "Move with the breath through a flowing, energising sequence that builds heat, strength and focus.",
  },
  {
    name: "Gentle Hatha",
    image: "hatha.jpg",
    frequency: "4x weekly",
    duration: "60 min",
    description:
      "Slow, foundational poses with mindful alignment — perfect for beginners and quiet mornings.",
  },
  {
    name: "Deep Yin",
    image: "yin.jpg",
    frequency: "3x weekly",
    duration: "75 min",
    description:
      "Long, supported holds that release deep tension in the hips, spine and connective tissue.",
  },
  {
    name: "Restore & Rest",
    image: "rest.jpg",
    frequency: "3x weekly",
    duration: "75 min",
    description:
      "Surrender into stillness with soft, supported shapes that calm the nervous system.",
  },
];
const methods = [
  {
    name: "Breathe",
    image: "breathe.jpg",
    description:
      "We begin with breath and nervous-system regulation — the fastest way out of stress and into the present moment.",
  },
  {
    name: "Move",
    image: "move.jpg",
    description:
      "Slow, deliberate strength and mobility that builds real stability in the body — steady, never strained.",
  },
  {
    name: "Restore",
    image: "restore.jpg",
    description:
      "Long, supported poses and deep rest, so everything you practised has the time to settle and truly integrate.",
  },
];
const faqs = [
  [
    "Who are your classes for?",
    "Everyone — complete beginners, busy parents, people returning after a break, and seasoned practitioners. Every class is small and adapted to who is in the room.",
  ],
  [
    "Do I need any experience or flexibility?",
    "Not at all. You don’t need to touch your toes or know any poses. Your teacher will offer options so you can move at your own pace.",
  ],
  [
    "What should I bring to my first class?",
    "Wear something comfortable and bring a water bottle. Mats, blocks, blankets and all the props you need are provided. Arrive a little early to settle in.",
  ],
  [
    "Can I practise online?",
    "Yes. Our practice is designed to meet you at home, too. Contact the studio for current livestream classes and access to the online library.",
  ],
  [
    "What is your cancellation policy?",
    "Memberships have no long contracts and you can cancel at any time. Contact the studio for class cancellation windows before booking.",
  ],
  [
    "Do you offer private or prenatal sessions?",
    "Yes, we offer personal sessions and gentle prenatal practice. Reach out to the studio so we can find the right teacher and a time that works for you.",
  ],
];
const plans = [
  {
    name: "Drop-in",
    subtitle: "Perfect for trying us out",
    price: "22",
    unit: "class",
    features: [
      "Any single class",
      "All levels welcome",
      "Book online in seconds",
      "Mat & props included",
      "No commitment",
    ],
  },
  {
    name: "Membership",
    subtitle: "Our most popular",
    price: "95",
    unit: "month",
    features: [
      "Unlimited studio classes",
      "Free online class library",
      "Priority class booking",
      "Bring-a-friend passes",
      "Cancel any time",
    ],
  },
  {
    name: "Class Pack",
    subtitle: "Flexible & great value",
    price: "180",
    unit: "10 classes",
    features: [
      "Ten classes, use anytime",
      "Valid for four months",
      "All levels welcome",
      "Online or in-person",
      "Share with a friend",
    ],
  },
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
        src={`/images/${file}`}
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
    <a href="#home" className="brand" aria-label="Yogagrove home">
      <Flower2 aria-hidden="true" strokeWidth={1.4} />
      <span>Yogagrove</span>
    </a>
  );
}
function Action({
  children = "Book a class",
  onClick,
  light = false,
}: {
  children?: ReactNode;
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <Button
      variant={light ? "secondary" : "default"}
      size="lg"
      onClick={onClick}
    >
      {children}
      <span className="button-arrow">
        <ArrowRight data-icon="inline-end" />
      </span>
    </Button>
  );
}

export function YogaGrove() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);
  const [info, setInfo] = useState<{ title: string; text: string } | null>(
    null,
  );
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const hero = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const { scrollYProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  useMotionValueEvent(scrollY, "change", (value) => setScrolled(value > 70));
  const nav = [
    { label: "About", href: "#about" },
    { label: "Classes", href: "#classes" },
    { label: "Schedule", action: () => setScheduleOpen(true) },
    { label: "Pricing", href: "#pricing" },
    { label: "Journal", href: "#journal" },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        Skip to content
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
          <nav aria-label="Main navigation" className="desktop-nav">
            {nav.map((item) =>
              item.href ? (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              ) : (
                <button key={item.label} onClick={item.action}>
                  {item.label}
                </button>
              ),
            )}
            <Action
              light={!scrolled}
              onClick={() => setBooking("Your first free class")}
            >
              Book a Class
            </Action>
          </nav>
          <Button
            variant="ghost"
            size="icon"
            className="menu-toggle"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
        {menuOpen && (
          <motion.nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            {nav.map((item) =>
              item.href ? (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  <ArrowUpRight />
                </a>
              ) : (
                <button
                  key={item.label}
                  onClick={() => {
                    item.action?.();
                    setMenuOpen(false);
                  }}
                >
                  {item.label}
                  <ArrowUpRight />
                </button>
              ),
            )}
            <Action
              onClick={() => {
                setBooking("Your first free class");
                setMenuOpen(false);
              }}
            >
              Book a Class
            </Action>
          </motion.nav>
        )}
      </header>
      <main id="main">
        <section id="home" className="hero" ref={hero}>
          <motion.div
            className="hero-image"
            style={{ y: reduced ? 0 : heroY }}
            initial={{ scale: reduced ? 1 : 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: "easeOut" }}
          >
            <Photo
              file="hero.png"
              alt="Yoga at sunrise beside a mountain lake"
              priority
            />
          </motion.div>
          <div className="hero-shade" />
          <div className="shell hero-inner">
            <motion.div
              initial={{ opacity: 0, y: reduced ? 0 : 35 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15 }}
              className="hero-copy"
            >
              <p className="eyebrow">● &nbsp; Yoga · Breathwork · Meditation</p>
              <h1>
                Find ease in
                <br />
                every breath.
              </h1>
              <p className="hero-description">
                Small-group yoga and mindful movement
                <br className="desktop-break" /> for every body, in-studio or at
                home.
              </p>
              <div className="actions">
                <Action
                  light
                  onClick={() => setBooking("Your first free class")}
                >
                  Book a free class
                </Action>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setScheduleOpen(true)}
                >
                  See the schedule
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="section shell tension">
          <Reveal className="section-heading centered">
            <Label>Is this you?</Label>
            <h2>
              The tension you have been
              <br className="desktop-break" /> told to simply live with.
            </h2>
            <p>
              Most of us carry the whole day in our bodies. If any of these feel
              familiar, your practice can meet you exactly there.
            </p>
          </Reveal>
          <div className="concerns-grid">
            {[
              {
                icon: CloudRain,
                text: "Stress and tension that never quite switches off",
              },
              {
                icon: Sofa,
                text: "Tight hips and stiffness from sitting all day",
              },
              {
                icon: BatteryLow,
                text: "Low, flat energy that coffee only masks",
              },
              {
                icon: PersonStanding,
                text: "Poor posture and a tight, aching back",
              },
              { icon: Moon, text: "Restless sleep and a busy, racing mind" },
              {
                icon: Wind,
                text: "Feeling disconnected from your body and breath",
              },
            ].map(({ icon: Icon, text }, i) => (
              <Reveal className="concern" key={text} delay={i * 0.04}>
                <span className="icon-circle">
                  <Icon strokeWidth={1.3} />
                </span>
                <p>{text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="about" className="section shell about-grid">
          <Reveal>
            <Photo
              file="naomi.jpg"
              alt="Naomi, Yogagrove founder, seated in a sunlit studio"
              className="about-photo"
            />
          </Reveal>
          <Reveal className="about-copy">
            <Label>About Yogagrove</Label>
            <h2>A calm place to come home to yourself.</h2>
            <p>
              Yogagrove grew from a small home practice into a studio built on
              one belief — that yoga should feel like ease, not another thing to
              achieve. Whether you are new to the mat or returning after years
              away, you are welcome exactly as you are.
            </p>
            <div className="stats">
              {[
                ["12+", "Years of practice"],
                ["8", "Students per class"],
                ["300+", "Members guided"],
              ].map(([n, label]) => (
                <div key={label}>
                  <strong>{n}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <Action
              onClick={() =>
                setInfo({
                  title: "A little more about us",
                  text: "Yogagrove began with a mat, a quiet room and a belief that movement should help you feel at home in your body. Today, our small studio brings that same care to every practice. With just eight students in each class, there is room to be seen, supported and welcomed exactly as you are. Meet our teachers below, or come along for your first free class.",
                })
              }
            >
              Read our story
            </Action>
          </Reveal>
        </section>

        <section className="section shell method-grid">
          <div className="method-intro">
            <Reveal>
              <Label>The Yogagrove Method</Label>
              <h2>
                A simple path
                <br />
                back to yourself.
              </h2>
              <p>
                Every class moves through the same gentle arc — no rush, no
                performance. Just three simple movements that guide your body
                home.
              </p>
              <Action onClick={() => setBooking("Your first free class")} />
            </Reveal>
          </div>
          <div className="method-stack">
            {methods.map((method, i) => (
              <motion.article
                key={method.name}
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
                <Photo
                  file={method.image}
                  alt={`${method.name} — a gentle yoga practice in the studio`}
                />
                <div className="method-shade" />
                <span className="method-number">0{i + 1}</span>
                <div className="method-caption">
                  <h3>{method.name}</h3>
                  <p>{method.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="classes" className="section shell">
          <Reveal className="section-heading split-heading">
            <div>
              <Label>Classes</Label>
              <h2>
                Unlock balance through
                <br />
                our daily yoga classes
              </h2>
            </div>
            <Action onClick={() => setBooking("A studio session")}>
              Book a session
            </Action>
          </Reveal>
          <div className="classes-grid">
            {classes.map((item, i) => (
              <Reveal key={item.name} delay={i * 0.06}>
                <button
                  className="class-card"
                  onClick={() => setBooking(item.name)}
                >
                  <div className="class-image">
                    <Photo file={item.image} alt={`${item.name} yoga class`} />
                    <div className="class-badges">
                      <Badge variant="secondary">{item.frequency}</Badge>
                      <Badge variant="secondary">{item.duration}</Badge>
                    </div>
                    <span className="class-arrow">
                      <ArrowUpRight />
                    </span>
                  </div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </button>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="benefits section">
          <div className="shell">
            <Reveal className="section-heading centered">
              <Label>Benefits</Label>
              <h2>
                How mindful movement
                <br />
                changes everything for you
              </h2>
            </Reveal>
            <div className="benefits-grid">
              {[
                { icon: PersonStanding, text: "Real, functional strength" },
                { icon: Wind, text: "A calmer, quieter mind" },
                { icon: MoveUpRight, text: "Freer hips and mobility" },
                { icon: Moon, text: "Deeper, more restful sleep" },
                { icon: Users, text: "A warm, welcoming community" },
                { icon: Heart, text: "Confidence in your body" },
              ].map(({ icon: Icon, text }, i) => (
                <Reveal key={text} className="benefit" delay={i * 0.04}>
                  <Icon strokeWidth={1.2} />
                  <h3>{text}</h3>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="teachers" className="section shell">
          <Reveal className="section-heading centered">
            <Label>Your teachers</Label>
            <h2>Meet the ones who will guide you.</h2>
            <p>
              A small, senior team — every class is led by an experienced
              teacher who knows your name and your practice.
            </p>
          </Reveal>
          <div className="teachers-grid">
            {[
              ["Naomi", "Founder · Vinyasa & Breath", "naomi.jpg"],
              ["Claire", "Yin & Restorative", "claire.jpg"],
              ["Emma", "Hatha & Prenatal", "emma.jpg"],
            ].map(([name, specialty, file], i) => (
              <Reveal key={name} delay={i * 0.08}>
                <Photo
                  file={file}
                  alt={`${name}, ${specialty}`}
                  className="teacher-photo"
                />
                <h3>{name}</h3>
                <p>{specialty}</p>
              </Reveal>
            ))}
          </div>
          <div className="center-action">
            <Action
              onClick={() =>
                setInfo({
                  title: "Your practice, thoughtfully guided",
                  text: "Naomi brings more than twelve years of practice to her Vinyasa and breathwork classes. Claire creates space for stillness through Yin and restorative yoga. Emma offers a grounded, welcoming approach to Hatha and prenatal practice. Each teacher offers variations, personal attention and a warm welcome for beginners.",
                })
              }
            >
              Meet the full team
            </Action>
          </div>
        </section>

        <section className="section testimonials">
          <div className="shell">
            <Reveal className="section-heading centered">
              <Label>Kind words</Label>
              <h2>
                Loved by people
                <br />
                who keep showing up.
              </h2>
              <p>
                A few honest words from the people who practise with us —
                beginners, parents-to-be and long-time regulars alike.
              </p>
            </Reveal>
            <Reveal className="featured-quote">
              <Photo
                file="student.png"
                alt="Thomas, a smiling Yogagrove student"
              />
              <div>
                <span className="stars" aria-label="5 out of 5 stars">
                  ★★★★★
                </span>
                <blockquote>
                  “I came for the flexibility and stayed for the calm — it’s the
                  one hour a week I now never miss.”
                </blockquote>
                <h4>Thomas Ward</h4>
                <p>Member since 2023</p>
              </div>
            </Reveal>
            <div className="quotes-grid">
              {[
                [
                  "The small classes make all the difference — the teacher actually adjusts you and remembers your name.",
                  "James Miller",
                  "Vinyasa regular",
                ],
                [
                  "I hadn’t moved in years and never felt judged once. Three months in, my back pain is basically gone.",
                  "Sarah Collins",
                  "Beginner",
                ],
                [
                  "Even the online classes feel personal — the streaming setup is genuinely well thought through.",
                  "Daniel Hughes",
                  "Online member",
                ],
              ].map(([quote, name, role]) => (
                <Reveal className="quote" key={name}>
                  <span className="stars" aria-label="5 out of 5 stars">
                    ★★★★★
                  </span>
                  <blockquote>“{quote}”</blockquote>
                  <h4>{name}</h4>
                  <p>{role}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="section shell">
          <Reveal className="section-heading centered">
            <Label>Pricing</Label>
            <h2>Simple pricing, no lock-in.</h2>
            <p>
              Drop in whenever suits you, or join as a member and save.
              <br />
              Cancel any time — no long contracts, ever.
            </p>
          </Reveal>
          <div className="pricing-grid">
            {plans.map((plan, i) => (
              <Reveal
                key={plan.name}
                className={cn("price-card", i === 1 && "price-featured")}
                delay={i * 0.08}
              >
                <div>
                  <h3>{plan.name}</h3>
                  <p>{plan.subtitle}</p>
                </div>
                <p className="price">
                  <sup>$</sup>
                  <strong>{plan.price}</strong>
                  <span>/{plan.unit}</span>
                </p>
                <Action
                  light={i === 1}
                  onClick={() =>
                    setBooking(`${plan.name} — $${plan.price}/${plan.unit}`)
                  }
                >
                  Select Plan
                </Action>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="faq" className="section shell faq-grid">
          <Reveal>
            <Label>FAQ</Label>
            <h2>
              Questions,
              <br />
              answered.
            </h2>
            <p>
              Everything you might want to know before your first class. Still
              curious?{" "}
              <a href="mailto:hello@yogagrove.studio" className="inline-link">
                Just reach out.
              </a>
            </p>
          </Reveal>
          <Reveal>
            <Accordion defaultValue={["faq-0"]}>
              {faqs.map(([question, answer], i) => (
                <AccordionItem key={question} value={`faq-${i}`}>
                  <AccordionTrigger>{question}</AccordionTrigger>
                  <AccordionContent>{answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </section>

        <section id="journal" className="section shell journal-section">
          <Reveal className="section-heading split-heading">
            <div>
              <Label>From the journal</Label>
              <h2>A little room to reflect.</h2>
            </div>
            <p>Simple notes for a more mindful everyday.</p>
          </Reveal>
          <div className="journal-grid">
            {[
              {
                title: "A softer start to your morning",
                image: "breathe.jpg",
                text: "Before reaching for your phone, take a moment to notice the room around you. Feel your feet on the floor. Let your shoulders settle. Take a few easy breaths without trying to change them. A gentle start does not need to be a long routine — just a little room to arrive.",
              },
              {
                title: "You don’t need to be flexible to begin",
                image: "hatha.jpg",
                text: "Yoga begins wherever you are today. Bend your knees, use a block, or take a rest whenever you need it. There is no perfect shape to reach. The practice is learning to pay attention, to move with curiosity and to meet your body with a little more kindness.",
              },
              {
                title: "The quiet importance of rest",
                image: "restore.jpg",
                text: "Some days, the most useful practice is a pause. Find a comfortable position, soften your jaw and let your breathing be natural. Notice the support beneath you. Rest belongs in your day just as much as movement does; you don’t have to earn it first.",
              },
            ].map((article) => (
              <Reveal key={article.title}>
                <button
                  className="journal-card"
                  onClick={() =>
                    setInfo({ title: article.title, text: article.text })
                  }
                >
                  <Photo file={article.image} alt={article.title} />
                  <span>MINDFUL LIVING · 2 MIN READ</span>
                  <h3>
                    {article.title}
                    <ArrowUpRight aria-hidden="true" />
                  </h3>
                </button>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="cta">
          <Photo
            file="cta.png"
            alt="A tranquil sunlit space for yoga and reflection"
          />
          <div className="cta-shade" />
          <Reveal className="cta-copy">
            <p className="eyebrow">Begin today</p>
            <h2>Your first class is on us.</h2>
            <p>
              Come as you are. Book a spot, roll out a mat, and see how you feel
              after just one hour with us.
            </p>
            <Action light onClick={() => setBooking("Your first free class")} />
          </Reveal>
        </section>
      </main>
      <footer className="footer">
        <div className="shell">
          <div className="footer-grid">
            <div className="footer-about">
              <Brand />
              <p>
                Small-group yoga and mindful movement — in the studio or
                streamed gently to your home.
              </p>
              <Leaf strokeWidth={1.2} aria-hidden="true" />
            </div>
            <div>
              <h4>Explore</h4>
              <a href="#about">About</a>
              <a href="#classes">Classes</a>
              <button onClick={() => setScheduleOpen(true)}>Schedule</button>
              <a href="#pricing">Pricing</a>
            </div>
            <div>
              <h4>Studio</h4>
              <a href="#about">Our Story</a>
              <a href="#teachers">Our Teachers</a>
              <a href="#journal">Journal</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <h4>Visit</h4>
              <a
                href="https://maps.google.com/?q=41+Gertrude+Street,+Fitzroy+VIC+3065"
                target="_blank"
                rel="noreferrer"
              >
                41 Gertrude Street,
                <br />
                Fitzroy VIC 3065
              </a>
              <a href="tel:+61394170432">(03) 9417 0432</a>
              <a href="mailto:hello@yogagrove.studio">hello@yogagrove.studio</a>
              <p>
                Mon–Fri 6am–9pm
                <br />
                Sat–Sun 7am–5pm
              </p>
            </div>
          </div>
          <div className="footer-wordmark" aria-hidden="true">
            yogagrove
          </div>
          <div className="footer-bottom">
            <p>© 2026 Yogagrove Studio. All rights reserved.</p>
            <a
              href="https://yogagrove.framer.website/privacy"
              target="_blank"
              rel="noreferrer"
            >
              Privacy Policy <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>

      <Dialog
        open={booking !== null}
        onOpenChange={(open) => {
          if (!open) setBooking(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="dialog-symbol">
              <Flower2 />
            </div>
            <DialogTitle>Make a little space for yourself.</DialogTitle>
            <DialogDescription>{booking}</DialogDescription>
          </DialogHeader>
          <p>
            We’d love to welcome you to the mat. Contact the studio to find a
            class and confirm availability.
          </p>
          <a
            className={buttonVariants({ size: "lg" })}
            href={`mailto:hello@yogagrove.studio?subject=${encodeURIComponent(`Class enquiry: ${booking ?? "Yoga"}`)}`}
          >
            Email the studio
            <ArrowUpRight data-icon="inline-end" />
          </a>
          <a className="dialog-phone" href="tel:+61394170432">
            Or call (03) 9417 0432
          </a>
        </DialogContent>
      </Dialog>
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="dialog-symbol">
              <Sun />
            </div>
            <DialogTitle>Find your rhythm.</DialogTitle>
            <DialogDescription>
              Our weekly classes. Contact the studio for current times and
              availability.
            </DialogDescription>
          </DialogHeader>
          <div className="schedule-list">
            {classes.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  setScheduleOpen(false);
                  setBooking(item.name);
                }}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.frequency} · {item.duration}
                  </span>
                </div>
                <ArrowUpRight />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={info !== null}
        onOpenChange={(open) => {
          if (!open) setInfo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="dialog-symbol">
              <Sparkles />
            </div>
            <DialogTitle>{info?.title}</DialogTitle>
            <DialogDescription>From Yogagrove, with care.</DialogDescription>
          </DialogHeader>
          <p className="article-body">{info?.text}</p>
        </DialogContent>
      </Dialog>
    </MotionConfig>
  );
}
