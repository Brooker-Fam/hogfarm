import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

// Rounded, friendly display face for headings — the whole farm-whimsy look
// leans on it. Exposed as a CSS variable so plain CSS and inline styles can both reach it.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "HogFarm: websites for your farm",
  description:
    "A reference implementation of the PostHog agentic provisioning API. Build a farm site, get PostHog analytics provisioned automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fredoka.variable}>
      <body>{children}</body>
    </html>
  );
}
