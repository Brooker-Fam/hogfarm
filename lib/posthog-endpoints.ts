import { HOST } from "@/lib/posthog-token";

const WINDOW_DAYS = 90;

/**
 * The dashboard's three reads, defined once as named saved queries. PostHog's
 * Endpoints product is the recommended way to read the same query over and over:
 * you publish it once and call it by name, versioned and rate-limited as a
 * first-class API. Endpoint names are unique per project, and each farm gets its
 * own project, so these fixed names are safe.
 *
 * Single-sourced here so the Endpoint definition and the query-API fallback in
 * posthog-analytics.ts never drift.
 */
export const DASHBOARD_ENDPOINTS = {
  dashboard_totals: {
    description: "Total pageviews and unique visitors over the dashboard window.",
    query: `SELECT count() AS pv, count(DISTINCT distinct_id) AS uv FROM events
            WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY`,
  },
  dashboard_trend: {
    description: "Daily pageview counts for the last seven days.",
    query: `SELECT toDate(timestamp) AS d, count() AS c FROM events
            WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
            GROUP BY d ORDER BY d`,
  },
  dashboard_top_paths: {
    description: "Most-visited paths over the dashboard window.",
    query: `SELECT properties.$pathname AS p, count() AS c FROM events
            WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
            GROUP BY p ORDER BY c DESC LIMIT 6`,
  },
} as const;

export type DashboardEndpointName = keyof typeof DASHBOARD_ENDPOINTS;

/**
 * Publish the dashboard's saved queries as Endpoints in a freshly provisioned
 * project. Needs endpoint:write. Idempotent: a name that already exists comes
 * back 400, which we treat as "already published" so a retried provision is safe.
 */
export async function createDashboardEndpoints(token: string, teamId: string): Promise<void> {
  await Promise.all(
    (Object.entries(DASHBOARD_ENDPOINTS) as [DashboardEndpointName, { description: string; query: string }][]).map(
      async ([name, { description, query }]) => {
        const res = await fetch(`${HOST}/api/projects/${teamId}/endpoints/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name,
            description,
            query: { kind: "HogQLQuery", query },
            is_active: true,
          }),
        });
        if (!res.ok && res.status !== 400) {
          throw new Error(`endpoint create ${name} failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
      },
    ),
  );
}

/**
 * Run a published endpoint by name. Needs endpoint:read. `refresh: "force"`
 * recomputes on every call instead of serving the cached result — a freshly
 * provisioned dashboard is viewed a handful of times right after setup and needs
 * to reflect events the moment they land, the same liveness the query API gives.
 * A higher-traffic dashboard would drop the force and let the cache serve.
 */
export async function runDashboardEndpoint<T = unknown[]>(
  token: string,
  teamId: string,
  name: DashboardEndpointName,
): Promise<T[]> {
  const res = await fetch(`${HOST}/api/projects/${teamId}/endpoints/${name}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ refresh: "force" }),
  });
  if (!res.ok) throw new Error(`endpoint run ${name} failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return (body.results ?? []) as T[];
}
