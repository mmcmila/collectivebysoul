import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import { notFound } from "next/navigation";
import { hasMenuAccess } from "@/lib/menu/access";
import { getMenuSections } from "@/lib/menu/data";
import { formatMoney } from "@/lib/tab/calc";
import "./menu.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HIDA Bar · Menü",
  robots: { index: false, follow: false },
};

/** Reachable only through the QR link (`/m/[key]`); everyone else gets a 404. */
export default async function MenuPage() {
  if (!(await hasMenuAccess())) notFound();
  const sections = await getMenuSections();
  return (
    <main className={`bar-menu ${cormorant.variable}`}>
      <div className="bar-menu-frame">
        <header className="bar-menu-head">
          <h1>HIDA BAR</h1>
          <span className="bar-menu-ornament" aria-hidden="true" />
          <p className="bar-menu-event">CROSSING I</p>
          <p className="bar-menu-place">Büyükada</p>
        </header>
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`menu-section-${index}`}>
            <h2 id={`menu-section-${index}`}>
              <span>{section.title}</span>
            </h2>
            <ul>
              {section.items.map((item) => (
                <li key={item.name}>
                  <span className="bar-menu-name">{item.name}</span>
                  <span className="bar-menu-dots" aria-hidden="true" />
                  <span className="bar-menu-price">
                    {formatMoney(item.price).replace(" ₺", "")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="bar-menu-note">Fiyatlar Türk Lirası cinsindendir</p>
      </div>
    </main>
  );
}
