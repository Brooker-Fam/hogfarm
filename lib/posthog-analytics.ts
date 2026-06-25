import { Farm } from "@/lib/db";
import { HOST, validAccessToken } from "@/lib/posthog-token";
import { fetchDashboardViaEndpoints } from "@/lib/posthog-endpoints";

export { HOST, validAccessToken };

export async function hogql<T = unknown[]>(token: string, teamId: string, query: string): Promise<T[]> {
  const res = await fetch(`${HOST}/api/projects/${teamId}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) throw new Error(`query failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  return (body.results ?? []) as T[];
}

export interface DashboardData {
  totalPageviews: number;
  uniqueVisitors: number;
  trend: Array<{ date: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

/**
 * Dashboard analytics. Newer farms (provisioned with `endpoint:write`) have saved,
 * materialized Endpoints in their project — we read those first. Farms provisioned
 * before that scope existed, or any endpoint miss, fall back to running the HogQL
 * inline against the project's query API.
 */
export async function getDashboardData(farm: Farm): Promise<DashboardData> {
  const viaEndpoints = await fetchDashboardViaEndpoints(farm).catch(() => null);
  if (viaEndpoints) return viaEndpoints;
  return getDashboardDataInline(farm);
}

const WINDOW_DAYS = 90;

export async function getDashboardDataInline(farm: Farm): Promise<DashboardData> {
  const token = await validAccessToken(farm);
  const tid = farm.posthogTeamId;

  const [totals, trendRows, pathRows] = await Promise.all([
    hogql<[number, number]>(
      token,
      tid,
      `SELECT count() AS pv, count(DISTINCT distinct_id) AS uv FROM events
       WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY`,
    ),
    hogql<[string, number]>(
      token,
      tid,
      `SELECT toDate(timestamp) AS d, count() AS c FROM events
       WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
       GROUP BY d ORDER BY d`,
    ),
    hogql<[string, number]>(
      token,
      tid,
      `SELECT properties.$pathname AS p, count() AS c FROM events
       WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
       GROUP BY p ORDER BY c DESC LIMIT 6`,
    ),
  ]);

  return {
    totalPageviews: totals[0]?.[0] ?? 0,
    uniqueVisitors: totals[0]?.[1] ?? 0,
    trend: trendRows.map((r) => ({ date: r[0], count: r[1] })),
    topPaths: pathRows.map((r) => ({ path: r[0] || "/", count: r[1] })),
  };
}
