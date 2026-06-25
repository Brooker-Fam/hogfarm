"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
      } else if (data.status === "requires_auth") {
        window.location.href = data.url;
      } else {
        router.push(`/dashboard/${data.slug}`);
      }
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <main className="landing">
      <section className="hero">
        <div className="sun" aria-hidden />
        <div className="cloud cloud-a" aria-hidden>☁️</div>
        <div className="cloud cloud-b" aria-hidden>☁️</div>
        <div className="cloud cloud-c" aria-hidden>☁️</div>

        <div className="hero-inner">
          <span className="tag">🌾 HogFarm</span>
          <h1>Put your farm online.<br />See who comes by.</h1>
          <p>Add your farm name and what you grow. You get a real website and a dashboard that shows how many people visited — analytics handled, nothing to install.</p>
          <div className="critters" aria-hidden>
            <span>🐔</span><span>🐄</span><span>🐷</span><span>🐑</span><span>🚜</span><span>🌻</span>
          </div>
        </div>

        <svg className="hills" viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden>
          <path d="M0 90 Q 240 40 480 78 T 960 70 T 1440 84 V150 H0 Z" fill="#bfe3a8" />
          <path d="M0 116 Q 280 70 560 104 T 1120 100 T 1440 110 V150 H0 Z" fill="#7cc25a" />
        </svg>
      </section>

      <div className="wrap">
      <form className="panel sign" onSubmit={create}>
        <div className="sign-top">
          <span className="sign-emoji" aria-hidden>🌱</span>
          <div>
            <h2 className="sign-title">Plant your farm</h2>
            <p className="sign-sub">Fill this in and we&apos;ll raise your site.</p>
          </div>
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
        <label htmlFor="products">What you grow (comma-separated)</label>
        <input id="products" value={form.products} onChange={set("products")} placeholder="Heirloom tomatoes, Raw honey, Free-range eggs" />

        <button type="submit" disabled={loading}>
          {loading ? "🌱 Growing your farm site…" : "🚜 Launch my farm site"}
        </button>
        {error && <div className="error">{error}</div>}
      </form>

      <div className="features">
        <div className="feature">
          <div className="fi">🪧</div>
          <h3>A site you can share today</h3>
          <p>Your farm gets a published page with a shop list, hours, and how to visit.</p>
        </div>
        <div className="feature">
          <div className="fi">📊</div>
          <h3>Visits show up on their own</h3>
          <p>Every page view — and every session recording — lands in your dashboard. Nothing to install.</p>
        </div>
        <div className="feature">
          <div className="fi">🦔</div>
          <h3>Runs on PostHog</h3>
          <p>HogFarm sets up a PostHog project for your site and reads the numbers back for you.</p>
        </div>
      </div>

      <p className="steps">
        This is a demo of the{" "}
        <a href="https://posthog.com/docs/integrate/provisioning" target="_blank" rel="noreferrer">PostHog provisioning API</a>.
        Making a farm creates a real PostHog account, adds tracking to your site, and reads the analytics back in.
      </p>
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
