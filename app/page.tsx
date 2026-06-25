"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// An engraved side-profile hog, the way an old stockyard brand would stamp it —
// snout, ear, ham, curly tail, with hatched shading. Reused as the wordmark,
// the hero seal, and the form seal.
function HogSeal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="47" fill="#f7efdb" stroke="#8f3320" strokeWidth="2.2" />
      <circle cx="50" cy="50" r="41.5" fill="none" stroke="#8f3320" strokeWidth="1" strokeDasharray="1.5 3.5" opacity="0.65" />
      <g fill="#2f5235">
        {/* legs */}
        <rect x="31" y="64" width="3.3" height="9.5" rx="1.4" />
        <rect x="40" y="65" width="3.3" height="9" rx="1.4" />
        <rect x="58" y="65" width="3.3" height="9" rx="1.4" />
        <rect x="66" y="64" width="3.3" height="9.5" rx="1.4" />
        {/* curly tail at the rump */}
        <path d="M73 50c6-1 5-7 1-6-2 .5-1.4 3 .8 2.6" stroke="#2f5235" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* body + head silhouette (overlapping fills read as one form) */}
        <ellipse cx="53" cy="55" rx="21" ry="13.5" />
        <circle cx="32" cy="53" r="11.5" />
        {/* snout */}
        <ellipse cx="20" cy="56.5" rx="5.6" ry="4.6" />
        {/* ear */}
        <path d="M35 43 L30 31 L42 42 Z" />
      </g>
      {/* nostrils + eye punched out */}
      <circle cx="18.9" cy="56.5" r="0.95" fill="#f7efdb" />
      <circle cx="21.2" cy="56.5" r="0.95" fill="#f7efdb" />
      <circle cx="29" cy="49.5" r="1.7" fill="#f7efdb" />
      {/* engraved shading on the ham */}
      <g stroke="#1f3624" strokeWidth="0.9" opacity="0.4" strokeLinecap="round">
        <path d="M60 48 l6 6" />
        <path d="M63 47 l6 6" />
        <path d="M66 49 l4 4" />
      </g>
    </svg>
  );
}

// A plowed hillside, drawn as contour furrows that compress toward the horizon
// so it reads as tilled earth rather than a flat green ribbon.
function Fields() {
  const rows = [0, 7, 15, 24, 34, 45, 57, 70];
  return (
    <svg className="fields" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f9d54" />
          <stop offset="0.55" stopColor="#5b8442" />
          <stop offset="1" stopColor="#4a6a33" />
        </linearGradient>
        <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c4dcab" />
          <stop offset="1" stopColor="#a9cd8b" />
        </linearGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      {/* far hill */}
      <path d="M0 86 Q 360 50 720 76 T 1440 74 V220 H0 Z" fill="url(#hill)" />
      <path d="M0 86 Q 360 50 720 76 T 1440 74" fill="none" stroke="#9cc07f" strokeWidth="2" />
      {/* a hedgerow of contour lines across the far hill so it isn't a flat slab */}
      <path d="M0 99 Q 360 64 720 90 T 1440 88" fill="none" stroke="#a9cd8b" strokeWidth="1.4" opacity="0.7" />
      <path d="M0 112 Q 360 78 720 103 T 1440 101" fill="none" stroke="#9ec47f" strokeWidth="1.4" opacity="0.6" />

      {/* near plowed field */}
      <path d="M0 150 Q 380 118 760 144 T 1440 140 V220 H0 Z" fill="url(#soil)" />
      {rows.map((o) => (
        <g key={o}>
          <path d={`M0 ${150 + o} Q 380 ${118 + o} 760 ${144 + o} T 1440 ${140 + o}`} fill="none" stroke="#3c5a2c" strokeWidth={1 + o / 28} opacity="0.55" />
          <path d={`M0 ${148 + o} Q 380 ${116 + o} 760 ${142 + o} T 1440 ${138 + o}`} fill="none" stroke="#85b066" strokeWidth={0.8 + o / 60} opacity="0.5" />
        </g>
      ))}

      {/* paper grain washed over the whole band */}
      <rect width="1440" height="220" filter="url(#grain)" opacity="0.08" />
    </svg>
  );
}

const PLATE_STROKE = { fill: "none", stroke: "#2f5235", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Builder() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", ownerName: "", email: "", location: "", tagline: "", products: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // The first call from a freshly versioned client_id comes back 202
      // "registering" while PostHog fetches our metadata document. Wait and retry
      // the same request a few times before giving up.
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await fetch("/api/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();

        if (data.code === "registering") {
          await new Promise((r) => setTimeout(r, 3000));
          continue;
        }
        if (data.status === "requires_auth") {
          window.location.href = data.url;
          return;
        }
        if (data.status === "complete" && data.slug) {
          router.push(`/dashboard/${data.slug}?k=${data.token}`);
          return;
        }
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      setError("Still setting up your account — give it a moment and try again.");
      setLoading(false);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <main className="landing">
      <header className="masthead">
        <div className="wordmark">
          <HogSeal className="seal" />
          HogFarm
        </div>
        <nav>
          <a href="#how">How it works</a>
          <a href="#features">The works</a>
          <a href="https://posthog.com/docs/integrate/provisioning" target="_blank" rel="noreferrer">PostHog</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <HogSeal className="seal-big" />
          <span className="stamp stamp--center">Farm websites &amp; plain-language visitor counts</span>
          <h1>
            Put your farm online.<br />
            See <em>who</em> stops by.
          </h1>
          <p className="lede">
            Tell us your farm name and what you grow. You get a real website and a plain-language
            dashboard of who visited — the analytics are wired up for you, nothing to install.
          </p>
          <div className="hero-cues">
            <span>Free to start</span>
            <span>Live in a minute</span>
            <span>Powered by PostHog</span>
          </div>
        </div>
        <Fields />
      </section>

      <div className="wrap" id="how">
        <div className="signup">
          <aside className="signup-rail">
            <span className="stamp">The deal</span>
            <h2>From a few facts to a farm on the web.</h2>
            <p>Fill the packet, plant it, and we raise the whole thing — page, tracking, and the numbers read back to you.</p>
            <ol className="rail-list">
              <li>
                <span className="ix">1</span>
                <div>
                  <h3>A page you can share today</h3>
                  <p>A published farm site with your shop list, hours, and how to visit.</p>
                </div>
              </li>
              <li>
                <span className="ix">2</span>
                <div>
                  <h3>Visitors count themselves</h3>
                  <p>Every page view and session recording lands in your dashboard — no setup.</p>
                </div>
              </li>
              <li>
                <span className="ix">3</span>
                <div>
                  <h3>Runs on PostHog</h3>
                  <p>We provision a real PostHog project and read the numbers back for you.</p>
                </div>
              </li>
            </ol>
          </aside>

          <form className="signup-form" onSubmit={create}>
            <div className="form-head">
              <div>
                <span className="lot">Lot № 001 — Heirloom</span>
                <h2>Plant your farm</h2>
              </div>
              <HogSeal className="seal" />
            </div>

            <div className="grid2">
              <div>
                <label htmlFor="name">Farm name *</label>
                <input id="name" value={form.name} onChange={set("name")} placeholder="Green Valley Farm" required />
              </div>
              <div>
                <label htmlFor="email">Email *</label>
                <input id="email" type="email" value={form.email} onChange={set("email")} placeholder="jane@greenvalley.com" required />
              </div>
              <div>
                <label htmlFor="ownerName">Your name</label>
                <input id="ownerName" value={form.ownerName} onChange={set("ownerName")} placeholder="Jane Farmer" />
              </div>
              <div>
                <label htmlFor="location">Location</label>
                <input id="location" value={form.location} onChange={set("location")} placeholder="Sonoma County, CA" />
              </div>
            </div>
            <label htmlFor="tagline">Tagline</label>
            <input id="tagline" value={form.tagline} onChange={set("tagline")} placeholder="Family-grown, picked this morning" />
            <label htmlFor="products">What you grow <span className="hint">— separate with commas</span></label>
            <input id="products" value={form.products} onChange={set("products")} placeholder="Heirloom tomatoes, Raw honey, Free-range eggs" />

            <button type="submit" disabled={loading}>
              {loading ? "Raising your farm site…" : "Launch my farm site"}
            </button>
            <p className="form-foot">Free. Your site goes live in about a minute — no account to set up, nothing to install.</p>
            {error && <div className="error">{error}</div>}
          </form>
        </div>

        <section className="almanac" id="features">
          <div className="almanac-head">
            <span className="stamp stamp--center">What&apos;s in the packet</span>
            <h2>Everything a small farm needs, none of the wiring.</h2>
          </div>
          <div className="features">
            <article className="packet packet--a">
              <div className="packet-head"><span>Packet · The site</span><span>№ 01</span></div>
              <div className="packet-plate">
                {/* an open farm stand with an awning and baskets of produce */}
                <svg width="96" height="74" viewBox="0 0 96 74" aria-hidden>
                  <g {...PLATE_STROKE}>
                    <path d="M14 30 L48 12 L82 30" />
                    <path d="M18 30 H78" />
                    <path d="M24 30 V60 M72 30 V60" />
                    <path d="M24 47 H72" />
                    <path d="M20 60 H76" />
                    {/* roof shadow-side hatching */}
                    <g strokeWidth="0.9" opacity="0.5">
                      <path d="M54 19 l7 4 M60 16 l8 4 M66 19 l8 4 M72 22 l6 3" />
                    </g>
                    {/* produce on the counter */}
                    <path d="M30 47 a4 4 0 0 1 8 0 z" />
                    <path d="M44 47 a4.5 4.5 0 0 1 9 0 z" />
                    <path d="M59 47 a4 4 0 0 1 8 0 z" />
                  </g>
                </svg>
              </div>
              <div className="packet-body">
                <h3>A site you can share today</h3>
                <p>A published page with your shop list, opening hours, and directions to the stand.</p>
              </div>
              <div className="packet-foot">Open-pollinated · ships same day</div>
            </article>

            <article className="packet packet--b">
              <div className="packet-head"><span>Packet · The counts</span><span>№ 02</span></div>
              <div className="packet-plate">
                {/* cloven hoof-prints climbing a lane — every print is a visit */}
                <svg width="96" height="74" viewBox="0 0 96 74" aria-hidden>
                  <g {...PLATE_STROKE} strokeWidth="1.2" opacity="0.5">
                    <path d="M28 68 L43 18" />
                    <path d="M68 68 L53 18" />
                  </g>
                  {/* each print is two cloven toes */}
                  <g fill="#2f5235">
                    <g transform="translate(43 58) rotate(-8)"><path d="M-2.6 0 q-1.7 -4 0 -7.5 q1.7 3.5 0 7.5z" /><path d="M2.6 0 q1.7 -4 0 -7.5 q-1.7 3.5 0 7.5z" /></g>
                    <g transform="translate(53 48) rotate(6)"><path d="M-2.4 0 q-1.6 -3.6 0 -7 q1.6 3.4 0 7z" /><path d="M2.4 0 q1.6 -3.6 0 -7 q-1.6 3.4 0 7z" /></g>
                    <g transform="translate(45 38) rotate(-6)"><path d="M-2.1 0 q-1.4 -3.2 0 -6 q1.4 3 0 6z" /><path d="M2.1 0 q1.4 -3.2 0 -6 q-1.4 3 0 6z" /></g>
                    <g transform="translate(51 29) rotate(5)"><path d="M-1.8 0 q-1.2 -2.8 0 -5.2 q1.2 2.6 0 5.2z" /><path d="M1.8 0 q1.2 -2.8 0 -5.2 q-1.2 2.6 0 5.2z" /></g>
                  </g>
                </svg>
              </div>
              <div className="packet-body">
                <h3>Visits show up on their own</h3>
                <p>Every page view — and every session recording — flows into your dashboard. Nothing to install.</p>
              </div>
              <div className="packet-foot">Self-counting · no thinning</div>
            </article>

            <article className="packet packet--c">
              <div className="packet-head"><span>Packet · The engine</span><span>№ 03</span></div>
              <div className="packet-plate">
                {/* a prairie windpump — the engine that keeps it all turning */}
                <svg width="96" height="74" viewBox="0 0 96 74" aria-hidden>
                  <g {...PLATE_STROKE}>
                    <path d="M38 64 L44 30 M58 64 L52 30" />
                    <path d="M41 54 H55 M42 46 H54 M43 38 H53" strokeWidth="1" opacity="0.7" />
                    <path d="M40 60 L56 50 M56 60 L40 50" strokeWidth="0.9" opacity="0.5" />
                    <path d="M48 64 V72" />
                    {/* vane */}
                    <path d="M52 27 L70 24 L70 33 L52 31" />
                    {/* fan of blades */}
                    <circle cx="48" cy="27" r="11" />
                    <path d="M48 27 L48 16 M48 27 L55.8 19.2 M48 27 L59 27 M48 27 L55.8 34.8 M48 27 L48 38 M48 27 L40.2 34.8 M48 27 L37 27 M48 27 L40.2 19.2" strokeWidth="1" />
                    <circle cx="48" cy="27" r="2.2" fill="#2f5235" />
                  </g>
                </svg>
              </div>
              <div className="packet-body">
                <h3>Runs on PostHog</h3>
                <p>HogFarm provisions a real PostHog project for your site and reads the numbers back for you.</p>
              </div>
              <div className="packet-foot">Perennial · runs year-round</div>
            </article>
          </div>
        </section>

        <footer className="colophon">
          <div className="colophon-rule" aria-hidden>
            <span /><HogSeal className="seal" /><span />
          </div>
          <p className="colophon-note">
            A live demo of the{" "}
            <a href="https://posthog.com/docs/integrate/provisioning" target="_blank" rel="noreferrer">PostHog provisioning API</a>.
            Making a farm creates a real account, adds tracking to your site, and reads the analytics back in.
          </p>
          <div className="colophon-meta">
            <span>Printed &amp; provisioned by HogFarm</span>
            <span>First edition · Lot 001</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Builder />
    </Suspense>
  );
}
