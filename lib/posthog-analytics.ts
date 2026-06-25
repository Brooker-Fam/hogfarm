import { Farm } from "@/lib/db";
import { HOST, validAccessToken } from "@/lib/posthog-token";
import { DASHBOARD_ENDPOINTS, runDashboardEndpoint } from "@/lib/posthog-endpoints";

export interface DashboardData {
  totalPageviews: number;
  uniqueVisitors: number;
  trend: Array<{ date: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

/** Fallback path: run a HogQL query inline against the project's query API. */
async function hogql<T = unknown[]>(token: string, teamId: string, query: string): Promise<T[]> {
  const res = await fetch(`${HOST}/api/projects/${teamId}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) throw new Error(`query failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return (body.results ?? []) as T[];
}

function shape(
  totals: Array<[number, number]>,
  trendRows: Array<[string, number]>,
  pathRows: Array<[string, number]>,
): DashboardData {
  return {
    totalPageviews: totals[0]?.[0] ?? 0,
    uniqueVisitors: totals[0]?.[1] ?? 0,
    trend: trendRows.map((r) => ({ date: r[0], count: r[1] })),
    topPaths: pathRows.map((r) => ({ path: r[0] || "/", count: r[1] })),
  };
}

/**
 * Dashboard analytics, read through the project's published Endpoints with the
 * farm's OAuth token (endpoint:read). Read live (`refresh: "force"`) so a
 * just-provisioned dashboard reflects events the moment they're ingested.
 *
 * Farms provisioned before HogFarm used Endpoints have none published and a token
 * without endpoint scopes, so we fall back to an inline HogQL query for them.
 */
export async function getDashboardData(farm: Farm): Promise<DashboardData> {
  const token = await validAccessToken(farm);
  const tid = farm.posthogTeamId;

  try {
    const [totals, trendRows, pathRows] = await Promise.all([
      runDashboardEndpoint<[number, number]>(token, tid, "dashboard_totals"),
      runDashboardEndpoint<[string, number]>(token, tid, "dashboard_trend"),
      runDashboardEndpoint<[string, number]>(token, tid, "dashboard_top_paths"),
    ]);
    return shape(totals, trendRows, pathRows);
  } catch (err) {
    console.error("endpoint read failed, falling back to inline query:", err);
    const [totals, trendRows, pathRows] = await Promise.all([
      hogql<[number, number]>(token, tid, DASHBOARD_ENDPOINTS.dashboard_totals.query),
      hogql<[string, number]>(token, tid, DASHBOARD_ENDPOINTS.dashboard_trend.query),
      hogql<[string, number]>(token, tid, DASHBOARD_ENDPOINTS.dashboard_top_paths.query),
    ]);
    return shape(totals, trendRows, pathRows);
  }
}
