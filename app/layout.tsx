import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Fraunces — a warm "old-style" soft serif with optical sizing. It carries the
// whole seed-catalogue / farm-almanac character of the headings.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-display",
});

// Hanken Grotesk — a clean, slightly warm humanist sans for body copy.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

// Spline Sans Mono — used only for the small letterpress "stamp" labels and
// numeric readouts, the way an old seed packet stamps a lot number.
const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-stamp",
});

export const metadata: Metadata = {
  title: "HogFarm — websites for your farm",
  description:
    "A reference implementation of the PostHog agentic provisioning API. Build a farm site, get PostHog analytics provisioned automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable} ${splineMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
