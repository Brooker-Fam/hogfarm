"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Result {
  projectApiKey: string;
  posthogHost: string;
}

function Builder() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [name, setName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));

  // The existing-user consent flow redirects back here with the result in the URL.
  const callbackResult: Result | null = params.get("status") === "complete"
    ? { projectApiKey: params.get("apiKey") ?? "", posthogHost: params.get("host") ?? "" }
    : null;

  const [result, setResult] = useState<Result | null>(callbackResult);

  async function openInPostHog() {
    setOpening(true);
    setError(null);
    try {
      const res = await fetch("/api/open-in-posthog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, farmName }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Could not open PostHog");
        setOpening(false);
      }
    } catch {
      setError("Network error");
      setOpening(false);
    }
  }

  async function provision(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, farmName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else if (data.status === "requires_auth") {
        // Existing PostHog user — bounce them to the consent screen.
        window.location.href = data.url;
        return;
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="hero">
        <span className="tag">Demo · PostHog provisioning</span>
        <h1>🌾 HogFarm</h1>
        <p>Spin up a website for your farm. Analytics included, automatically.</p>
      </div>

      {!result && (
        <form className="panel" onSubmit={provision}>
          <label htmlFor="farmName">Farm name</label>
          <input id="farmName" value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="Green Acres" required />

          <label htmlFor="name">Your name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Farmer" />

          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@greenacres.com" required />

          <button type="submit" disabled={loading}>
            {loading ? "Provisioning analytics…" : "Create my farm site"}
          </button>
        </form>
      )}

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="panel result">
          <h2>🎉 Your farm site is live with analytics</h2>
          <p style={{ color: "var(--muted)" }}>
            We provisioned a PostHog project behind the scenes. Your site sends events with this
            project key:
          </p>
          {result.projectApiKey && <div className="kv">{result.projectApiKey}</div>}
          <div className="kv">{result.posthogHost}</div>
          <button className="open" onClick={openInPostHog} disabled={opening || !email}>
            {opening ? "Opening…" : "Open in PostHog →"}
          </button>
        </div>
      )}

      <div className="steps">
        <p>What happened when you clicked the button:</p>
        <ol>
          <li>HogFarm called <code>account_requests</code> with your email and a PKCE challenge.</li>
          <li>PostHog created (or located) your account and returned an authorization code.</li>
          <li>HogFarm exchanged the code for tokens, then called <code>resources</code> to provision a project.</li>
          <li>The project API key got wired into your farm site. &quot;Open in PostHog&quot; re-runs the handshake to land you in your project.</li>
        </ol>
        <p>
          Full walkthrough in the{" "}
          <a href="https://posthog.com/docs/integrate/provisioning" target="_blank" rel="noreferrer">
            provisioning docs
          </a>
          .
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
