import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { clientId } from "@/lib/client-id";
import { createPkce } from "@/lib/pkce";
import { createAccountRequest, ProvisioningError } from "@/lib/posthog-provisioning";

/**
 * The "Open in PostHog" button.
 *
 * We re-run account_requests for an already-provisioned user. Because they now
 * exist in PostHog, we get back a `requires_auth` URL — the consent/login
 * handshake that lands them in their project. This is the deep-linking pattern
 * every CIMD partner can use without the privileged /deep_links endpoint.
 *
 * https://posthog.com/docs/integrate/provisioning#deep-linking
 */
export async function POST(request: NextRequest) {
  const { email, farmName } = await request.json();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const pkce = createPkce();

  try {
    const account = await createAccountRequest({
      id: randomUUID(),
      email,
      name: email,
      clientId: clientId(request),
      codeChallenge: pkce.challenge,
      scopes: ["insight:read", "project:read", "person:read"],
      region: "US",
      organizationName: farmName,
    });

    if (account.type === "requires_auth") {
      return NextResponse.json({ url: account.url });
    }

    // Silently linked (rare here) — there's no consent URL to send them to, so
    // point at the project list as a fallback.
    return NextResponse.json({ url: "https://us.posthog.com/" });
  } catch (err) {
    if (err instanceof ProvisioningError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}
