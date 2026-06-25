import type { Farm } from "@/lib/db";
import type { DashboardData } from "@/lib/posthog-analytics";
import { HOST, validAccessToken } from "@/lib/posthog-token";

/**
 * The dashboard's analytics, published as PostHog Endpoints — saved, server-side
 * HogQL queries each farm's project owns and we call by name. This is the read
 * pattern PostHog steers customers toward over ad-hoc query calls: a stable,
 * cached API surface.
 *
 * Endpoints live per-project, so we create them once at provision time (see
 * provisionEndpoints, called from the provisioning flow) using the `endpoint:write`
 * scope. Creating them needs that write scope; *running* them is a plain read, so
 * the dashboard can call them with the same token it uses for everything else.
 *
 * We deliberately do NOT materialize at provision time. A freshly materialized
 * endpoint serves from a backing view that hasn't run its first refresh yet, so it
 * returns *empty* until then (up to data_freshness_seconds) — which left the trend
 * and top-pages panels showing zeros on a brand-new dashboard even though the data
 * was there. Unmaterialized endpoints query live and are correct immediately.
 * Materialization is a later optimization for a farm with steady traffic, not a
 * day-one default — which is also PostHog's own guidance for low-traffic endpoints.
 *
 * Each farm creates its endpoints exactly once, so the first version is always 1 —
 * we pin `?version=1` on reads so a future query edit (which cuts a new version)
 * can't silently change a live farm's numbers.
 */

const WINDOW_DAYS = 90;
const FRESHNESS_SECONDS = 3600;
const VERSION = 1;

interface EndpointSpec {
  name: string;
  query: string;
}

const SPECS = {
  totals: {
    name: "hogfarm_pageview_totals",
    query: `SELECT count() AS pv, count(DISTINCT distinct_id) AS uv FROM events
            WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY`,
  },
  trend: {
    name: "hogfarm_pageview_trend",
    query: `SELECT toDate(timestamp) AS d, count() AS c FROM events
            WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
            GROUP BY d ORDER BY d`,
  },
  topPaths: {
    name: "hogfarm_top_paths",
    query: `SELECT properties.$pathname AS p, count() AS c FROM events
            WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
            GROUP BY p ORDER BY c DESC LIMIT 6`,
  },
} satisfies Record<string, EndpointSpec>;

function endpointsUrl(teamId: string, suffix = ""): string {
  return `${HOST}/api/projects/${teamId}/endpoints/${suffix}`;
}

function authHeaders(token: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function createEndpoint(token: string, teamId: string, spec: EndpointSpec): Promise<boolean> {
  const res = await fetch(endpointsUrl(teamId), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: spec.name,
      query: { kind: "HogQLQuery", query: spec.query },
      data_freshness_seconds: FRESHNESS_SECONDS,
    }),
  });
  // 201 created, or 400 if it already exists (re-provisioning the same project) —
  // either way the endpoint is there to materialize and read.
  return res.ok || res.status === 400;
}

/**
 * Create the dashboard endpoints in a freshly provisioned project. Requires an
 * `endpoint:write` token. Best-effort: a failure here just means the dashboard
 * falls back to inline HogQL, so callers should not let it fail provisioning.
 *
 * Endpoints are created unmaterialized on purpose — see the module header.
 */
export async function provisionEndpoints(token: string, teamId: string): Promise<void> {
  await Promise.all(Object.values(SPECS).map((spec) => createEndpoint(token, teamId, spec)));
}

async function runEndpoint<T>(token: string, teamId: string, name: string): Promise<T[] | null> {
  const res = await fetch(endpointsUrl(teamId, `${name}/run/?version=${VERSION}`), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return (body.results ?? null) as T[] | null;
}

/**
 * Read the dashboard from the project's endpoints. Returns null on any miss (older
 * farm with no endpoints, an endpoint that failed to provision, a transient error)
 * so getDashboardData falls back to inline HogQL.
 */
export async function fetchDashboardViaEndpoints(farm: Farm): Promise<DashboardData | null> {
  const token = await validAccessToken(farm);
  const tid = farm.posthogTeamId;

  const [totals, trendRows, pathRows] = await Promise.all([
    runEndpoint<[number, number]>(token, tid, SPECS.totals.name),
    runEndpoint<[string, number]>(token, tid, SPECS.trend.name),
    runEndpoint<[string, number]>(token, tid, SPECS.topPaths.name),
  ]);

  if (!totals || !trendRows || !pathRows) return null;

  return {
    totalPageviews: totals[0]?.[0] ?? 0,
    uniqueVisitors: totals[0]?.[1] ?? 0,
    trend: trendRows.map((r) => ({ date: r[0], count: r[1] })),
    topPaths: pathRows.map((r) => ({ path: r[0] || "/", count: r[1] })),
  };
}
