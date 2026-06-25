import { Farm } from "@/lib/db";
import { getTheme } from "@/lib/themes";
import { ProduceIcon } from "@/components/ProduceIcon";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function monogram(name: string): string {
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase() || "F";
}

function ringText(name: string): string {
  const up = name.toUpperCase();
  return `${up} · EST · ${up} · EST · `;
}

// A wax-seal crest carrying the farm's monogram and name set on a ring — fills
// the hero so it reads as a composed brand mark, not a collapsed template.
function Crest({ name, primary, primaryDark }: { name: string; primary: string; primaryDark: string }) {
  return (
    <svg viewBox="0 0 200 200" width="252" height="252" aria-hidden style={{ filter: "drop-shadow(0 10px 20px rgba(60,40,15,0.18))" }}>
      <defs>
        <path id="crestring" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" />
      </defs>
      <circle cx="100" cy="100" r="92" fill="#fffaef" stroke={primaryDark} strokeWidth="2.5" />
      <circle cx="100" cy="100" r="84" fill="none" stroke={primaryDark} strokeWidth="1" strokeDasharray="1.5 4" opacity="0.6" />
      <circle cx="100" cy="100" r="58" fill={primary} />
      <circle cx="100" cy="100" r="58" fill="none" stroke="#fffaef" strokeWidth="1.5" opacity="0.5" />
      <text fill={primaryDark} fontFamily="var(--stamp)" fontSize="11" letterSpacing="3" fontWeight={500}>
        <textPath href="#crestring" startOffset="0">{ringText(name)}</textPath>
      </text>
      <text x="100" y="118" textAnchor="middle" fill="#fffaef" fontFamily="var(--display)" fontWeight={700} fontSize="64">{monogram(name)}</text>
    </svg>
  );
}

// A themed plowed-field band, mirroring the HogFarm landing but tinted to the
// farm's own primary colour (light/dark furrows are alpha layers, no colour math).
function FieldBand({ color }: { color: string }) {
  const rows = [0, 10, 21, 33, 46];
  return (
    <svg viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden
      style={{ position: "absolute", left: 0, right: 0, bottom: -1, width: "100%", height: 124, display: "block" }}>
      <path d="M0 96 Q 380 64 760 90 T 1440 86 V150 H0 Z" fill={color} />
      {rows.map((o) => (
        <g key={o}>
          <path d={`M0 ${96 + o} Q 380 ${64 + o} 760 ${90 + o} T 1440 ${86 + o}`} fill="none" stroke="rgba(0,0,0,0.09)" strokeWidth={1 + o / 40} />
          <path d={`M0 ${93.5 + o} Q 380 ${61.5 + o} 760 ${87.5 + o} T 1440 ${83.5 + o}`} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.7} />
        </g>
      ))}
    </svg>
  );
}

export function FarmSiteView({ farm }: { farm: Farm }) {
  const t = getTheme(farm.theme);
  const hours: [string, string][] = [
    ["Saturday", "8:00 – 14:00"],
    ["Sunday", "9:00 – 13:00"],
    ["Wed – Fri", "By appointment"],
    ["Mon – Tue", "Closed"],
  ];

  return (
    <div style={{ position: "relative", background: t.bg, color: t.text, minHeight: "100vh", fontFamily: "var(--body)" }}>
      <div aria-hidden style={{ position: "fixed", inset: 0, backgroundImage: GRAIN, opacity: 0.05, mixBlendMode: "multiply", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 28px", maxWidth: 1040, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span aria-hidden style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: t.primary, color: "#fff", fontFamily: "var(--display)", fontWeight: 700, fontSize: 19, boxShadow: `0 0 0 3px ${t.bg}, 0 0 0 4px ${t.heroTo}` }}>{monogram(farm.name)}</span>
            <span style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 21, letterSpacing: "-0.01em" }}>{farm.name}</span>
          </div>
          <nav style={{ display: "flex", gap: 24, fontFamily: "var(--stamp)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            <a href="#shop" style={{ color: t.muted, textDecoration: "none" }}>Shop</a>
            <a href="#hours" style={{ color: t.muted, textDecoration: "none" }}>Hours</a>
            <a href="#visit" style={{ color: t.muted, textDecoration: "none" }}>Visit</a>
          </nav>
        </header>

        <section style={{ position: "relative", overflow: "hidden", background: `linear-gradient(165deg, ${t.heroFrom}, ${t.heroTo})`, padding: "72px 28px 146px" }}>
          <div style={{ position: "relative", maxWidth: 1040, margin: "0 auto", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 440px", minWidth: 300 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--stamp)", fontSize: 11, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase", color: t.primaryDark }}>
                <span style={{ width: 24, height: 1, background: "currentColor", opacity: 0.5 }} />
                {farm.location ? `Farm stand · ${farm.location}` : "Family farm stand"}
              </span>
              <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(40px, 6vw, 64px)", lineHeight: 1.04, margin: "16px 0 16px", letterSpacing: "-0.02em", color: t.text }}>{farm.name}</h1>
              <p style={{ fontSize: "clamp(18px, 2vw, 22px)", color: t.text, opacity: 0.82, margin: "0 0 30px", maxWidth: 480 }}>{farm.tagline || "Family-grown and picked at peak ripeness."}</p>
              <a href="#shop" style={{ display: "inline-block", background: t.primary, color: "#fff", padding: "14px 26px", borderRadius: 11, textDecoration: "none", fontFamily: "var(--display)", fontWeight: 600, fontSize: 16, boxShadow: `0 4px 0 0 ${t.primaryDark}` }}>
                See what&apos;s in season
              </a>
            </div>
            <div style={{ flex: "0 0 auto", display: "grid", placeItems: "center" }}>
              <Crest name={farm.name} primary={t.primary} primaryDark={t.primaryDark} />
            </div>
          </div>
          <FieldBand color={t.primary} />
        </section>

        <section id="shop" style={{ maxWidth: 1040, margin: "0 auto", padding: "72px 28px" }}>
          <span style={{ fontFamily: "var(--stamp)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: t.muted }}>The farm stand</span>
          <h2 style={{ fontFamily: "var(--display)", fontSize: "clamp(28px, 4vw, 38px)", margin: "10px 0 6px" }}>What we grow</h2>
          <p style={{ color: t.muted, margin: "0 0 32px" }}>Picked at peak ripeness and sold at the stand.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {farm.products.map((product, i) => (
              <div key={product} style={{ background: t.panel, border: `1px solid ${t.heroTo}`, borderRadius: 14, padding: "22px", boxShadow: "0 14px 30px -26px rgba(0,0,0,0.5)" }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, display: "grid", placeItems: "center", background: t.heroFrom, border: `1px solid ${t.heroTo}`, marginBottom: 14 }}>
                  <ProduceIcon product={product} color={t.primaryDark} size={28} />
                </div>
                <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 18 }}>{product}</div>
                <div style={{ color: t.muted, fontSize: 13, marginTop: 4, fontFamily: "var(--stamp)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{i % 3 === 1 ? "At the stand" : i % 3 === 2 ? "Picked weekly" : "In season now"}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="hours" style={{ background: t.panel, borderTop: `1px solid ${t.heroTo}`, borderBottom: `1px solid ${t.heroTo}` }}>
          <div style={{ maxWidth: 1040, margin: "0 auto", padding: "64px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
            <div>
              <span style={{ fontFamily: "var(--stamp)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: t.muted }}>When to come by</span>
              <h2 style={{ fontFamily: "var(--display)", fontSize: 30, margin: "10px 0 18px" }}>Farm stand hours</h2>
              {hours.map(([d, h]) => (
                <div key={d} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${t.bg}`, fontSize: 16 }}>
                  <span style={{ fontWeight: 600 }}>{d}</span>
                  <span style={{ color: t.muted, fontFamily: "var(--stamp)", fontSize: 13 }}>{h}</span>
                </div>
              ))}
            </div>
            <div id="visit">
              <span style={{ fontFamily: "var(--stamp)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: t.muted }}>Find us</span>
              <h2 style={{ fontFamily: "var(--display)", fontSize: 30, margin: "10px 0 18px" }}>Visit us</h2>
              <p style={{ color: t.muted, fontSize: 16, lineHeight: 1.7 }}>
                {farm.location ? <>Find us in <strong style={{ color: t.text }}>{farm.location}</strong>. </> : null}
                Stop by the stand for the freshest pick of the week, or say hello{farm.ownerName ? <> to {farm.ownerName}</> : null} and the team.
              </p>
              <div style={{ marginTop: 20, fontSize: 15, color: t.muted, display: "grid", gap: 8 }}>
                <div>📍 {farm.location || "Open-air farm stand"}</div>
                <div>✉️ hello@{farm.slug}.farm</div>
              </div>
            </div>
          </div>
        </section>

        <footer style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 28px", color: t.muted, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>© {farm.name}</span>
          <span style={{ fontFamily: "var(--stamp)", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 11 }}>Raised with HogFarm</span>
        </footer>
      </div>
    </div>
  );
}
