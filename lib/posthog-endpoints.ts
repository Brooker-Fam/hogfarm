import type { Farm } from "@/lib/db";
import type { DashboardData } from "@/lib/posthog-analytics";
import { HOST, validAccessToken } from "@/lib/posthog-token";

/**
 * The dashboard's analytics, published as PostHog Endpoints — saved, server-side
 * HogQL queries each farm's project owns and we call by name. This is the read
 * pattern PostHog steers customers toward over ad-hoc query calls: a stable,
 * cached (and where the query shape allows, materialized) API surface.
 *
 * Endpoints live per-project, so we create them once at provision time (see
 * provisionEndpoints, called from the provisioning flow) using the `endpoint:write`
 * scope. Creating them needs that write scope; *running* them is a plain read, so
 * the dashboard can call them with the same token it uses for everything else.
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
 * Best-effort materialization. The update path degrades gracefully: a query whose
 * shape can't be materialized (e.g. count(DISTINCT ...), ORDER BY ... LIMIT) comes
 * back with a `materialization_error` and stays a live, unmaterialized endpoint
 * rather than failing — so we never block provisioning on it.
 */
async function tryMaterialize(token: string, teamId: string, name: string): Promise<void> {
  const res = await fetch(endpointsUrl(teamId, `${name}/`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ is_materialized: true }),
  });
  if (!res.ok) return;
  const body = await res.json().catch(() => ({}));
  if (body.materialization_error) {
    console.warn(`endpoint ${name} not materialized: ${body.materialization_error}`);
  }
}

/**
 * Create (and where possible materialize) the dashboard endpoints in a freshly
 * provisioned project. Requires an `endpoint:write` token. Best-effort: a failure
 * here just means the dashboard falls back to inline HogQL, so callers should not
 * let it fail provisioning.
 */
export async function provisionEndpoints(token: string, teamId: string): Promise<void> {
  for (const spec of Object.values(SPECS)) {
    const created = await createEndpoint(token, teamId, spec);
    if (created) await tryMaterialize(token, teamId, spec.name).catch(() => {});
  }
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
