import { createHash, randomBytes, randomUUID } from "node:crypto";

const HOST = "https://us.posthog.com";
const CAPTURE = "https://us.i.posthog.com";
const V = "0.1d";
const CLIENT_ID = "https://hogfarm-guava-tri.vercel.app/.well-known/posthog-client.json";
const b64 = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const verifier = b64(randomBytes(32));
const challenge = b64(createHash("sha256").update(verifier).digest());
const email = `rockwrestlerun+hfq${Date.now()}@gmail.com`;
const log = (...a) => console.log(...a);

// 1. account_requests
const ar = await (await fetch(`${HOST}/api/agentic/provisioning/account_requests`, {
  method: "POST", headers: { "API-Version": V, "Content-Type": "application/json" },
  body: JSON.stringify({ id: randomUUID(), email, name: "Q Farm", client_id: CLIENT_ID,
    code_challenge: challenge, code_challenge_method: "S256",
    scopes: ["query:read", "insight:read", "project:read", "person:read"],
    configuration: { region: "US", organization_name: "Q Farm" } }),
})).json();
log("1. account_requests:", ar.type);
if (ar.type !== "oauth") { log("   not oauth, abort:", JSON.stringify(ar)); process.exit(0); }

// 2. token
const tok = await (await fetch(`${HOST}/api/agentic/oauth/token`, {
  method: "POST", headers: { "API-Version": V, "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "authorization_code", code: ar.oauth.code, code_verifier: verifier }),
})).json();
log("2. token: scope =", JSON.stringify(tok.scope), "| has refresh =", !!tok.refresh_token);
const access = tok.access_token;

// 3. resources
const resv = await (await fetch(`${HOST}/api/agentic/provisioning/resources`, {
  method: "POST", headers: { "API-Version": V, "Content-Type": "application/json", Authorization: `Bearer ${access}` },
  body: JSON.stringify({ service_id: "free", label_prefix: "Q Farm", configuration: { project_name: "Q Farm site" } }),
})).json();
const apiKey = resv.complete?.access_configuration?.api_key;
const teamId = resv.id;
log("3. resources: team =", teamId, "| key =", apiKey?.slice(0, 12) + "…");

// 4. seed traffic via capture batch (historical timestamps over last 7 days)
const paths = ["/", "/shop", "/hours", "/about", "/", "/shop", "/"];
const batch = [];
for (let d = 0; d < 7; d++) {
  const visits = 3 + (d % 4);
  for (let i = 0; i < visits; i++) {
    const ts = new Date(Date.now() - d * 86400000 - i * 3600000).toISOString();
    const path = paths[(d + i) % paths.length];
    batch.push({ event: "$pageview", distinct_id: `visitor_${d}_${i}`, timestamp: ts,
      properties: { $current_url: `https://qfarm.example${path}`, $pathname: path } });
  }
}
const cap = await fetch(`${CAPTURE}/batch/`, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ api_key: apiKey, historical_migration: false, batch }) });
log(`4. capture: seeded ${batch.length} pageviews -> ${cap.status} ${(await cap.text()).slice(0,60)}`);

// 5. query API with the OAuth token (the read-back)
async function hogql(q) {
  const r = await fetch(`${HOST}/api/projects/${teamId}/query/`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: q } }),
  });
  return { status: r.status, body: await r.json() };
}
const cnt = await hogql("SELECT count() FROM events WHERE event = '$pageview'");
log("5. query API status:", cnt.status, "| result:", JSON.stringify(cnt.body.results ?? cnt.body).slice(0, 120));

// 6. refresh token
const rf = await (await fetch(`${HOST}/api/agentic/oauth/token`, {
  method: "POST", headers: { "API-Version": V, "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tok.refresh_token }),
})).json();
log("6. refresh: new access =", !!rf.access_token, "| new refresh =", !!rf.refresh_token, rf.error ? `| error=${rf.error}` : "");
log("\nteamId for later:", teamId, "apiKey:", apiKey);
