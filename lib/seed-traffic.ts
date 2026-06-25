/**
 * Seed a realistic week of traffic into a freshly provisioned project so the
 * dashboard has something to show immediately. These are demo pageviews sent
 * through PostHog's capture API. Real visits to the published farm site stack on top.
 *
 * We deliberately do NOT set historical_migration. That flag routes the whole batch
 * to PostHog's historical ingestion topic, which is intentionally throttled and can
 * take many minutes to become queryable — so the dashboard sits empty right after
 * provisioning, which is the opposite of what we want. The real-time pipeline accepts
 * these backdated timestamps fine (it stores the event timestamp, not arrival time)
 * and makes them queryable in seconds.
 */

const CAPTURE: Record<string, string> = {
  US: "https://us.i.posthog.com",
  EU: "https://eu.i.posthog.com",
};

const PAGES = ["/", "/", "/", "/shop", "/shop", "/hours", "/about"];

export async function seedTraffic(apiKey: string, region: string, siteUrl: string): Promise<number> {
  const host = CAPTURE[region] ?? CAPTURE.US;

  // A fixed pool of visitors reused across days gives believable unique counts.
  const visitors = Array.from({ length: 38 }, (_, i) => `visitor_${i}`);
  const batch: unknown[] = [];

  for (let day = 6; day >= 0; day--) {
    const dow = (new Date().getDay() - day + 7) % 7;
    const weekendDip = dow === 0 || dow === 6 ? 0.6 : 1;
    const sessions = Math.round((10 + day * 1.5) * weekendDip); // gentle upward trend

    for (let s = 0; s < sessions; s++) {
      const visitor = visitors[(day * 7 + s) % visitors.length];
      const hour = 8 + ((s * 3) % 12);
      const ts = new Date(Date.now() - day * 86400000);
      ts.setHours(hour, (s * 17) % 60, 0, 0);

      const pageCount = 1 + (s % 3);
      for (let p = 0; p < pageCount; p++) {
        const path = PAGES[(s + p) % PAGES.length];
        batch.push({
          event: "$pageview",
          distinct_id: visitor,
          timestamp: new Date(ts.getTime() + p * 45000).toISOString(),
          properties: {
            distinct_id: visitor,
            $current_url: `${siteUrl}${path === "/" ? "" : path}`,
            $pathname: path,
            $host: new URL(siteUrl).host,
          },
        });
      }
    }
  }

  const res = await fetch(`${host}/batch/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, batch }),
  });
  if (!res.ok) throw new Error(`seed failed ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return batch.length;
}
