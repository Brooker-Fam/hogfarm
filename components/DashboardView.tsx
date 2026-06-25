import Link from "next/link";
import { Farm } from "@/lib/db";
import { DashboardData } from "@/lib/posthog-analytics";
import { AutoRefresh } from "@/components/AutoRefresh";

const HOST_FOR: Record<string, string> = {
  US: "https://us.posthog.com",
  EU: "https://eu.posthog.com",
};

function last7Days(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-06-24" → "Jun 24" — farm owners read months, not ISO.
function humanDate(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${MONTHS[Number(m[1]) - 1]} ${Number(m[2])}`;
}

function Stamp({ children }: { children: React.ReactNode }) {
  return <span className="stamp">{children}</span>;
}

function TrendChart({ data }: { data: DashboardData }) {
  const byDate = new Map(data.trend.map((t) => [t.date, t.count]));
  const days = last7Days().map((d) => ({ date: d, count: byDate.get(d) ?? 0 }));
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 168, marginTop: 14 }}>
      {days.map((d) => (
        <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ fontFamily: "var(--stamp)", fontSize: 12, color: "var(--ink-soft)" }}>{d.count}</div>
          <div
            title={`${d.date}: ${d.count} pageviews`}
            style={{ width: "100%", height: `${(d.count / max) * 120}px`, minHeight: 3, background: "linear-gradient(180deg, var(--forest), var(--forest-deep))", borderRadius: "4px 4px 0 0", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)" }}
          />
          <div style={{ fontFamily: "var(--stamp)", fontSize: 11, color: "var(--muted)" }}>{humanDate(d.date)}</div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel" style={{ padding: 22 }}>
      <div style={{ fontFamily: "var(--stamp)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "var(--display)", fontSize: 34, fontWeight: 600, lineHeight: 1, color: "var(--ink)" }}>{value}</div>
      {sub ? <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6, fontFamily: "var(--stamp)" }}>{sub}</div> : null}
    </div>
  );
}

function ReplayPanel({ host, teamId, embedUrl, debugReason }: { host: string; teamId: string; embedUrl: string | null; debugReason: string | null }) {
  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <Stamp>Session replays</Stamp>
      <p style={{ color: "var(--ink-soft)", margin: "10px 0 0" }}>
        Watch real visitors move through your farm site — every click and scroll, recorded automatically.
      </p>
      {embedUrl ? (
        <>
          <iframe
            src={embedUrl}
            title="Latest session replay"
            allowFullScreen
            style={{ width: "100%", height: 480, border: "1px solid var(--line)", borderRadius: 13, background: "var(--bg)", marginTop: 14 }}
          />
          <a className="player-cta" href={`${host}/project/${teamId}/replay`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 12 }}>
            See all replays in PostHog →
          </a>
        </>
      ) : (
        <>
          <a className="player" href={`${host}/project/${teamId}/replay`} target="_blank" rel="noreferrer">
            <div className="player-screen">
              <div className="play" aria-hidden>▶</div>
            </div>
            <span className="player-cta">No replays yet — open replays in PostHog →</span>
          </a>
          {debugReason ? (
            <pre style={{ marginTop: 12, fontSize: 12, color: "var(--muted)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>debug: {debugReason}</pre>
          ) : null}
        </>
      )}
    </div>
  );
}

export function DashboardView({
  farm,
  data,
  error,
  replay,
  debug,
}: {
  farm: Farm;
  data: DashboardData | null;
  error: boolean;
  replay: { url: string | null; reason: string | null };
  debug: boolean;
}) {
  const host = HOST_FOR[farm.region] ?? HOST_FOR.US;
  const sevenDayTotal = data?.trend.reduce((s, t) => s + t.count, 0) ?? 0;
  const busiest = data?.trend.reduce((m, t) => (t.count > m.count ? t : m), { date: "—", count: 0 });
  const maxPath = Math.max(1, ...(data?.topPaths.map((p) => p.count) ?? [1]));

  return (
    <main style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <Stamp>HogFarm dashboard</Stamp>
          <h1 style={{ margin: "10px 0 4px", fontSize: 38 }}>{farm.name}</h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>Analytics for your farm site, pulled live from PostHog.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link className="open" href={`/sites/${farm.slug}`} target="_blank">Visit site ↗</Link>
          <a className="open" style={{ background: "transparent", color: "var(--forest)", boxShadow: "inset 0 0 0 1px var(--line-strong)" }}
             href={`${host}/project/${farm.posthogTeamId}`} target="_blank" rel="noreferrer">
            Open in PostHog →
          </a>
        </div>
      </div>

      {error || !data || data.totalPageviews === 0 ? (
        <div className="panel" style={{ marginTop: 28 }}>
          <Stamp>Warming up</Stamp>
          <h2 style={{ margin: "12px 0 8px" }}>Gathering your analytics…</h2>
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>
            Your site just went live and visits are flowing into PostHog. This page fills in
            automatically as they arrive — no need to refresh.
          </p>
          <AutoRefresh seconds={8} />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 28 }}>
            <Kpi label="Pageviews · 90 days" value={data.totalPageviews.toLocaleString()} />
            <Kpi label="Unique visitors" value={data.uniqueVisitors.toLocaleString()} />
            <Kpi label="Last 7 days" value={sevenDayTotal.toLocaleString()} />
            <Kpi label="Busiest day" value={busiest && busiest.count > 0 ? humanDate(busiest.date) : "—"} sub={busiest?.count ? `${busiest.count} views` : ""} />
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <Stamp>Pageviews · last 7 days</Stamp>
            <TrendChart data={data} />
          </div>

          <ReplayPanel host={host} teamId={farm.posthogTeamId} embedUrl={replay.url} debugReason={debug ? replay.reason : null} />

          <div className="panel" style={{ marginTop: 20 }}>
            <Stamp>Top pages</Stamp>
            <div style={{ marginTop: 14 }}>
              {data.topPaths.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>No pageviews yet.</p>
              ) : (
                data.topPaths.map((p) => (
                  <div key={p.path} style={{ margin: "12px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 5 }}>
                      <span style={{ fontFamily: "var(--stamp)" }}>{p.path}</span>
                      <span style={{ color: "var(--muted)", fontFamily: "var(--stamp)" }}>{p.count}</span>
                    </div>
                    <div style={{ height: 9, background: "var(--bg)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--line)" }}>
                      <div style={{ width: `${(p.count / maxPath) * 100}%`, height: "100%", background: "linear-gradient(180deg, var(--forest), var(--forest-deep))" }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 20 }}>
            HogFarm reads this live with the OAuth token from when your account was provisioned — a HogQL{" "}
            <code>query:read</code> call against your own PostHog project. See it all in full at{" "}
            <a href={`${host}/project/${farm.posthogTeamId}`} target="_blank" rel="noreferrer">PostHog</a>.
          </p>
        </>
      )}
    </main>
  );
}
