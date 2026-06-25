import { createHmac, timingSafeEqual } from "node:crypto";

// A per-farm capability token: an HMAC of the slug under the server-only
// HOGFARM_ENC_KEY (domain-separated from token encryption in crypto.ts).
// Unguessable without the key, so only someone the provisioning flow handed the
// link to can open the dashboard. Stateless — no DB column, no expiry. A production
// build would expire/rotate it and avoid putting the token in the URL.
function sign(slug: string): string {
  const secret = process.env.HOGFARM_ENC_KEY;
  if (!secret) throw new Error("HOGFARM_ENC_KEY is not set");
  return createHmac("sha256", Buffer.from(secret, "hex")).update(`hogfarm-dashboard:${slug}`).digest("base64url");
}

export function dashboardToken(slug: string): string {
  return sign(slug);
}

export function verifyDashboardToken(slug: string, token: string | undefined): boolean {
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(sign(slug));
  return a.length === b.length && timingSafeEqual(a, b);
}
