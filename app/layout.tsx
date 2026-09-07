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
  title: "Yogagrove — Yoga & Wellness Studio",
  description:
    "Find ease in every breath. Small-group yoga, breathwork and mindful movement for every body, in-studio or at home.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
