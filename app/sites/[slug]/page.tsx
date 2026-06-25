import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFarmBySlug } from "@/lib/db";
import { getTheme } from "@/lib/themes";
import { PostHogScript } from "@/components/PostHogScript";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const farm = await getFarmBySlug((await params).slug);
  return farm ? { title: farm.name, description: farm.tagline } : { title: "Farm" };
}

const PRODUCE_EMOJI: Record<string, string> = {
  egg: "🥚", honey: "🍯", vegetable: "🥬", tomato: "🍅", corn: "🌽", apple: "🍎",
  berry: "🫐", strawberr: "🍓", milk: "🥛", cheese: "🧀", bread: "🍞", flower: "🌷",
  pumpkin: "🎃", squash: "🎃", herb: "🌿", lettuce: "🥬", carrot: "🥕", pepper: "🫑",
  meat: "🥩", chicken: "🐔", lamb: "🐑", wool: "🧶", jam: "🍓", cider: "🍎",
};

function emojiFor(product: string): string {
  const p = product.toLowerCase();
  for (const [k, v] of Object.entries(PRODUCE_EMOJI)) if (p.includes(k)) return v;
  return "🧺";
}

export default async function FarmSite({ params }: { params: Promise<{ slug: string }> }) {
  const farm = await getFarmBySlug((await params).slug);
  if (!farm) notFound();
  const t = getTheme(farm.theme);

  return (
    <div style={{ background: t.bg, color: t.text, minHeight: "100vh", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <PostHogScript apiKey={farm.projectApiKey} region={farm.region} />

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ fontWeight: 700, fontSize: 20, display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 26 }}>{t.emoji}</span> {farm.name}
        </div>
        <nav style={{ display: "flex", gap: 22, color: t.muted, fontSize: 15 }}>
          <a href="#shop" style={{ color: t.muted, textDecoration: "none" }}>Shop</a>
          <a href="#hours" style={{ color: t.muted, textDecoration: "none" }}>Hours</a>
          <a href="#visit" style={{ color: t.muted, textDecoration: "none" }}>Visit</a>
        </nav>
      </header>

      <section style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${t.heroFrom}, ${t.heroTo})`, padding: "84px 28px" }}>
        <span aria-hidden style={{ position: "absolute", top: 36, right: "10%", fontSize: 52, opacity: 0.9, animation: "drift 24s ease-in-out infinite" }}>☁️</span>
        <span aria-hidden style={{ position: "absolute", top: 96, right: "32%", fontSize: 34, opacity: 0.8, animation: "drift 30s ease-in-out infinite reverse" }}>☁️</span>
        <div style={{ position: "relative", maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>{t.emoji}</div>
          <h1 style={{ fontFamily: "var(--display)", fontSize: 52, margin: "0 0 14px", letterSpacing: "-0.02em", maxWidth: 720 }}>{farm.name}</h1>
          <p style={{ fontSize: 22, color: t.text, opacity: 0.8, margin: "0 0 28px", maxWidth: 600 }}>{farm.tagline}</p>
          <a href="#shop" style={{ background: t.primary, color: "#fff", padding: "14px 26px", borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: 16 }}>
            See what&apos;s in season →
          </a>
        </div>
      </section>

      <section id="shop" style={{ maxWidth: 1040, margin: "0 auto", padding: "72px 28px" }}>
        <h2 style={{ fontSize: 32, margin: "0 0 8px" }}>What we grow</h2>
        <p style={{ color: t.muted, margin: "0 0 32px" }}>Picked at peak ripeness and sold at the farm stand.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
          {farm.products.map((product) => (
            <div key={product} style={{ background: t.panel, border: `1px solid ${t.heroTo}`, borderRadius: 14, padding: "26px 22px" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{emojiFor(product)}</div>
              <div style={{ fontWeight: 600, fontSize: 18 }}>{product}</div>
              <div style={{ color: t.muted, fontSize: 14, marginTop: 4 }}>In season now</div>
            </div>
          ))}
        </div>
      </section>

      <section id="hours" style={{ background: t.panel, borderTop: `1px solid ${t.heroTo}`, borderBottom: `1px solid ${t.heroTo}` }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "64px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
          <div>
            <h2 style={{ fontSize: 32, margin: "0 0 18px" }}>Farm stand hours</h2>
            {[
              ["Saturday", "8:00 – 14:00"],
              ["Sunday", "9:00 – 13:00"],
              ["Wed – Fri", "By appointment"],
              ["Mon – Tue", "Closed"],
            ].map(([d, h]) => (
              <div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${t.bg}`, fontSize: 16 }}>
                <span style={{ fontWeight: 600 }}>{d}</span>
                <span style={{ color: t.muted }}>{h}</span>
              </div>
            ))}
          </div>
          <div id="visit">
            <h2 style={{ fontSize: 32, margin: "0 0 18px" }}>Visit us</h2>
            <p style={{ color: t.muted, fontSize: 16, lineHeight: 1.7 }}>
              {farm.location ? <>Find us in <strong style={{ color: t.text }}>{farm.location}</strong>. </> : null}
              Stop by the stand for the freshest pick of the week, or say hello{farm.ownerName ? <> to {farm.ownerName}</> : null} and the team.
            </p>
            <div style={{ marginTop: 20, fontSize: 15, color: t.muted }}>
              <div>📍 {farm.location || "Open-air farm stand"}</div>
              <div style={{ marginTop: 8 }}>✉️ hello@{farm.slug}.farm</div>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px", color: t.muted, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
        <span>© {farm.name}</span>
        <span>Built with 🌾 HogFarm</span>
      </footer>
    </div>
  );
}
