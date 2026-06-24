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
    <main>
      <div className="hero">
        <span className="tag">🌾 HogFarm</span>
        <h1>Beautiful websites for your farm. Analytics built in.</h1>
        <p>Launch a farm site in seconds and watch the visitors roll in — no signup, no setup, no analytics to wire up.</p>
      </div>

      <form className="panel" onSubmit={create}>
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
          {loading ? "Building your farm site…" : "Launch my farm site"}
        </button>
        {error && <div className="error">{error}</div>}
      </form>

      <div className="features">
        <div className="feature">
          <div className="fi">🌱</div>
          <h3>A real site, instantly</h3>
          <p>Your farm gets a published, shareable website — hero, shop, hours, the works.</p>
        </div>
        <div className="feature">
          <div className="fi">📊</div>
          <h3>Analytics that just work</h3>
          <p>Every visit is tracked automatically. See it all in your HogFarm dashboard.</p>
        </div>
        <div className="feature">
          <div className="fi">🔌</div>
          <h3>Powered by PostHog</h3>
          <p>Behind the scenes, HogFarm provisions a PostHog project and pulls the data back for you.</p>
        </div>
      </div>

      <p className="steps">
        A demo of the{" "}
        <a href="https://posthog.com/docs/integrate/provisioning" target="_blank" rel="noreferrer">PostHog provisioning API</a>.
        Creating a farm provisions a real PostHog account, embeds tracking on your site, and reads the analytics back in.
      </p>
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
