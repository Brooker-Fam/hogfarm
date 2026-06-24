import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HogFarm — farm websites with built-in analytics",
  description:
    "A reference implementation of the PostHog agentic provisioning API. Build a farm site, get PostHog analytics provisioned automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
