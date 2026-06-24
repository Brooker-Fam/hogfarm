import { Farm, updateTokens } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/posthog-provisioning";

const HOST = process.env.POSTHOG_PROVISIONING_HOST ?? "https://us.posthog.com";

/**
 * Return a usable access token for this farm, refreshing and persisting if the
 * stored one is within a minute of expiring. Refresh tokens rotate, so we write
 * the new pair straight back.
 */
async function validAccessToken(farm: Farm): Promise<string> {
  const fresh = farm.tokenExpiry.getTime() - Date.now() > 60_000;
  if (fresh) return decrypt(farm.accessTokenEnc);

  const tokens = await refreshAccessToken(decrypt(farm.refreshTokenEnc));
  await updateTokens(
    farm.slug,
    encrypt(tokens.accessToken),
    encrypt(tokens.refreshToken),
    new Date(Date.now() + tokens.expiresIn * 1000),
  );
  return tokens.accessToken;
}

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

export interface DashboardData {
  totalPageviews: number;
  uniqueVisitors: number;
  trend: Array<{ date: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

export async function getDashboardData(farm: Farm): Promise<DashboardData> {
  const token = await validAccessToken(farm);
  const tid = farm.posthogTeamId;

  const [totals, trendRows, pathRows] = await Promise.all([
    hogql<[number, number]>(
      token,
      tid,
      "SELECT count() AS pv, count(DISTINCT distinct_id) AS uv FROM events WHERE event = '$pageview'",
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
       WHERE event = '$pageview' GROUP BY p ORDER BY c DESC LIMIT 6`,
    ),
  ]);

  return {
    totalPageviews: totals[0]?.[0] ?? 0,
    uniqueVisitors: totals[0]?.[1] ?? 0,
    trend: trendRows.map((r) => ({ date: r[0], count: r[1] })),
    topPaths: pathRows.map((r) => ({ path: r[0] || "/", count: r[1] })),
  };
}
