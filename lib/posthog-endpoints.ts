import { HOST } from "@/lib/posthog-token";

/**
 * Publish the dashboard's queries as PostHog Endpoints — saved, server-side HogQL
 * queries each farm's project owns and can call by name. Endpoints live per-project,
 * so we create them once at provision time using the `endpoint:write` scope.
 *
 * These are a showcase / starting point, not the dashboard's data source. The live
 * dashboard reads inline (see getDashboardData) because an Endpoint serves a cached
 * result — fresh only within its data_freshness window — which on a just-provisioned
 * project would freeze the dashboard on its initial empty read. Endpoints shine for
 * stable, high-traffic, repeated reads; we create them here so a farm owner can build
 * on them (or materialize them) once their site has steady traffic.
 */

const WINDOW_DAYS = 90;
const FRESHNESS_SECONDS = 3600;

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

async function createEndpoint(token: string, teamId: string, spec: EndpointSpec): Promise<boolean> {
  const res = await fetch(`${HOST}/api/projects/${teamId}/endpoints/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: spec.name,
      query: { kind: "HogQLQuery", query: spec.query },
      data_freshness_seconds: FRESHNESS_SECONDS,
    }),
  });
  // 201 created, or 400 if it already exists (re-provisioning the same project).
  return res.ok || res.status === 400;
}

/**
 * Create the dashboard endpoints in a freshly provisioned project. Requires an
 * `endpoint:write` token. Best-effort: callers should not let a failure here fail
 * provisioning — the dashboard doesn't depend on these.
 */
export async function provisionEndpoints(token: string, teamId: string): Promise<void> {
  await Promise.all(Object.values(SPECS).map((spec) => createEndpoint(token, teamId, spec)));
}
