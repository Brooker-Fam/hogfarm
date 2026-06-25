import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { clientId, shortLivedCookieOpts, origin } from "@/lib/client-id";
import { createPkce } from "@/lib/pkce";
import { createAccountRequest, ProvisioningError } from "@/lib/posthog-provisioning";
import { finishProvisioning, FarmInput } from "@/lib/provision-flow";
import { dashboardToken } from "@/lib/dashboard-auth";

// endpoint:write publishes the dashboard's saved queries as Endpoints at provision
// time; endpoint:read runs them. sharing_configuration:write lets HogFarm mint a
// public embed token for a farm's latest session recording (rendered inline on the
// dashboard). session_recording:read covers reading recording metadata. project:write
// turns on session recording for the freshly provisioned project. query:read is the
// fallback for farms provisioned before Endpoints existed. These must stay within the
// CIMD scope ceiling (see posthog-client-v6.json).
const SCOPES = [
  "query:read",
  "endpoint:read",
  "endpoint:write",
  "insight:read",
  "project:read",
  "person:read",
  "session_recording:read",
  "sharing_configuration:write",
  "project:write",
];

function normalizeInput(raw: Record<string, unknown>): FarmInput {
  const name = String(raw.name ?? "").trim();
  const products = String(raw.products ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    name,
    ownerName: String(raw.ownerName ?? "").trim(),
    email: String(raw.email ?? "").trim(),
    tagline: String(raw.tagline ?? "").trim() || `Fresh from ${name}`,
    location: String(raw.location ?? "").trim(),
    products: products.length ? products : ["Farm eggs", "Raw honey", "Seasonal vegetables"],
  };
}

export async function POST(request: NextRequest) {
  const input = normalizeInput(await request.json());

  if (!input.email || !input.name) {
    return NextResponse.json({ error: "Farm name and email are required" }, { status: 400 });
  }

  const pkce = createPkce();

  try {
    const account = await createAccountRequest({
      id: randomUUID(),
      email: input.email,
      name: input.ownerName || input.email,
      clientId: clientId(request),
      codeChallenge: pkce.challenge,
      scopes: SCOPES,
      region: "US",
      organizationName: input.name,
    });

    // Existing PostHog user: consent in the browser. Stash everything we need to
    // finish after the redirect in httpOnly cookies.
    if (account.type === "requires_auth") {
      const opts = shortLivedCookieOpts(request);
      const state = new URL(account.url).searchParams.get("state") ?? "";
      const res = NextResponse.json({ status: "requires_auth", url: account.url });
      res.cookies.set("hogfarm_pkce", pkce.verifier, opts);
      res.cookies.set("hogfarm_state", state, opts);
      res.cookies.set("hogfarm_input", JSON.stringify(input), opts);
      return res;
    }

    const { slug } = await finishProvisioning({
      code: account.code,
      verifier: pkce.verifier,
      input,
      region: "US",
      origin: origin(request),
    });
    return NextResponse.json({ status: "complete", slug, token: dashboardToken(slug) });
  } catch (err) {
    if (err instanceof ProvisioningError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}
