import { NextRequest, NextResponse } from "next/server";
import { finishProvisioning } from "@/lib/provision-flow";
import { ProvisioningError } from "@/lib/posthog-provisioning";

/**
 * Redirect target for the existing-user consent flow. PostHog sends the user
 * back here with an authorization code once they approve the consent screen.
 * We recover the PKCE verifier we stashed before the redirect and finish the
 * same three-step flow as the new-user path.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const verifier = request.cookies.get("hogfarm_pkce")?.value;
  const expectedState = request.cookies.get("hogfarm_state")?.value;
  const farmName = request.cookies.get("hogfarm_farm")?.value ?? "Your farm";
  const email = request.cookies.get("hogfarm_email")?.value ?? "";

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/?error=${reason}`, request.url));
    clearCookies(res);
    return res;
  };

  if (!code || !verifier) return fail("missing_code");
  // CSRF binding: the state echoed back must match the one we initiated with.
  if (!expectedState || returnedState !== expectedState) return fail("state_mismatch");

  try {
    const result = await finishProvisioning({ code, verifier, farmName, email, region: "US" });

    // The apiKey is a publishable project token (phc_), safe to expose to the
    // browser. The user's email stays in the httpOnly cookie — we don't put PII
    // in the redirect URL.
    const url = new URL("/", request.url);
    url.searchParams.set("status", "complete");
    url.searchParams.set("apiKey", result.projectApiKey);
    url.searchParams.set("host", result.posthogHost);
    url.searchParams.set("teamId", result.teamId);

    const res = NextResponse.redirect(url);
    clearCookies(res);
    return res;
  } catch (err) {
    const reason = err instanceof ProvisioningError ? err.code : "provisioning_failed";
    return fail(reason);
  }
}

function clearCookies(res: NextResponse) {
  res.cookies.delete("hogfarm_pkce");
  res.cookies.delete("hogfarm_farm");
  res.cookies.delete("hogfarm_email");
  res.cookies.delete("hogfarm_state");
}
