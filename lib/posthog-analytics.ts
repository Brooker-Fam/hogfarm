import { Farm } from "@/lib/db";
import { HOST, validAccessToken } from "@/lib/posthog-token";

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

const WINDOW_DAYS = 90;

/**
 * Dashboard analytics, read live with the farm's OAuth token (a HogQL `query:read`
 * call against the project's query API). We read inline rather than through the
 * project's saved Endpoints on purpose: an Endpoint serves a cached/materialized
 * result (fresh only within its data_freshness window), which on a just-provisioned
 * project means the dashboard freezes on the initial empty read until the cache
 * expires. Inline always reflects current data — the right trade-off for a dashboard
 * that's viewed right after provisioning while events are still arriving.
 */
export async function getDashboardData(farm: Farm): Promise<DashboardData> {
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
