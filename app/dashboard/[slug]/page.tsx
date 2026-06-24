import { notFound } from "next/navigation";
import Link from "next/link";
import { getFarmBySlug } from "@/lib/db";
import { getDashboardData, DashboardData } from "@/lib/posthog-analytics";

export const dynamic = "force-dynamic";

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

function TrendChart({ data }: { data: DashboardData }) {
  const byDate = new Map(data.trend.map((t) => [t.date, t.count]));
  const days = last7Days().map((d) => ({ date: d, count: byDate.get(d) ?? 0 }));
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, marginTop: 8 }}>
      {days.map((d) => (
        <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.count}</div>
          <div
            title={`${d.date}: ${d.count} pageviews`}
            style={{ width: "100%", height: `${(d.count / max) * 120}px`, minHeight: 3, background: "var(--accent)", borderRadius: "4px 4px 0 0" }}
          />
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{d.date.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

export default async function Dashboard({ params }: { params: Promise<{ slug: string }> }) {
  const farm = await getFarmBySlug((await params).slug);
  if (!farm) notFound();

  let data: DashboardData | null = null;
  let error = false;
  try {
    data = await getDashboardData(farm);
  } catch {
    error = true;
  }

  const host = HOST_FOR[farm.region] ?? HOST_FOR.US;
  const sevenDayTotal = data?.trend.reduce((s, t) => s + t.count, 0) ?? 0;
  const busiest = data?.trend.reduce((m, t) => (t.count > m.count ? t : m), { date: "—", count: 0 });
  const maxPath = Math.max(1, ...(data?.topPaths.map((p) => p.count) ?? [1]));

  return (
    <main style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <span className="tag">HogFarm dashboard</span>
          <h1 style={{ margin: "0 0 4px" }}>{farm.name}</h1>
          <p style={{ color: "var(--muted)", margin: 0 }}>Analytics for your farm site, pulled live from PostHog.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link className="open" href={`/sites/${farm.slug}`} target="_blank">Visit site ↗</Link>
          <a className="open" style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--border)" }}
             href={`${host}/project/${farm.posthogTeamId}`} target="_blank" rel="noreferrer">
            Open in PostHog →
          </a>
        </div>
      </div>

      {error || !data ? (
        <div className="panel" style={{ marginTop: 28 }}>
          <h2 style={{ marginTop: 0 }}>Gathering your analytics…</h2>
          <p style={{ color: "var(--muted)" }}>
            Your site just went live and visits are flowing into PostHog. Refresh in a few seconds to see them.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 28 }}>
            <Kpi label="Pageviews (all time)" value={data.totalPageviews.toLocaleString()} />
            <Kpi label="Unique visitors" value={data.uniqueVisitors.toLocaleString()} />
            <Kpi label="Last 7 days" value={sevenDayTotal.toLocaleString()} />
            <Kpi label="Busiest day" value={busiest && busiest.count > 0 ? busiest.date.slice(5) : "—"} sub={busiest?.count ? `${busiest.count} views` : ""} />
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Pageviews, last 7 days</h2>
            <TrendChart data={data} />
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>Top pages</h2>
            {data.topPaths.length === 0 ? (
              <p style={{ color: "var(--muted)" }}>No pageviews yet.</p>
            ) : (
              data.topPaths.map((p) => (
                <div key={p.path} style={{ margin: "12px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{p.path}</span>
                    <span style={{ color: "var(--muted)" }}>{p.count}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--bg)", borderRadius: 4 }}>
                    <div style={{ width: `${(p.count / maxPath) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 4 }} />
                  </div>
                </div>
              ))
            )}
          </div>

          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 20 }}>
            HogFarm reads this with the OAuth token from provisioning your account — a HogQL <code>query:read</code> call
            against your own PostHog project. The same data lives in full at{" "}
            <a href={`${host}/project/${farm.posthogTeamId}`} target="_blank" rel="noreferrer">PostHog</a>.
          </p>
        </>
      )}
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700 }}>{value}</div>
      {sub ? <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}
