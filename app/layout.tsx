import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const poppins = localFont({
  variable: "--font-poppins",
  src: [
    { path: "./fonts/poppins-400.ttf", weight: "400" },
    { path: "./fonts/poppins-500.ttf", weight: "500" },
    { path: "./fonts/poppins-600.ttf", weight: "600" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  icons: { icon: "/assets/mark.svg" },
  openGraph: {
    title: "Leave the city behind.",
    description:
      "One Day on an Island · Chapter I: The Crossing · 19 Eylül 2026 · Büyükada",
    images: ["/assets/web/hero.webp"],
  },
  title: "One Day on an Island — 19 Eylül 2026, Büyükada",
  description:
    "Elli kişi, Büyükada’da denize açılan bir ev ve öğleden gece yarısına uzanan bir gün: atölyeler, havuz, müzik, yemek ve deniz yolculuğu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
