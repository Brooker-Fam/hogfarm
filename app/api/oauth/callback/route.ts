import { NextRequest, NextResponse } from "next/server";
import { finishProvisioning, FarmInput } from "@/lib/provision-flow";
import { origin } from "@/lib/client-id";
import { ProvisioningError } from "@/lib/posthog-provisioning";
import { dashboardToken } from "@/lib/dashboard-auth";

/**
 * Redirect target for the existing-user consent flow. PostHog returns an
 * authorization code here once the user approves. We recover the PKCE verifier
 * and the pending farm input from cookies and finish building the site.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const verifier = request.cookies.get("hogfarm_pkce")?.value;
  const expectedState = request.cookies.get("hogfarm_state")?.value;
  const inputRaw = request.cookies.get("hogfarm_input")?.value;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/?error=${reason}`, request.url));
    clearCookies(res);
    return res;
  };

  if (!code || !verifier || !inputRaw) return fail("missing_code");
  if (!expectedState || returnedState !== expectedState) return fail("state_mismatch");

  try {
    const input = JSON.parse(inputRaw) as FarmInput;
    const { slug } = await finishProvisioning({
      code,
      verifier,
      input,
      region: "US",
      origin: origin(request),
    });
    const res = NextResponse.redirect(new URL(`/dashboard/${slug}?k=${dashboardToken(slug)}`, request.url));
    clearCookies(res);
    return res;
  } catch (err) {
    return fail(err instanceof ProvisioningError ? err.code : "provisioning_failed");
  }
}

function clearCookies(res: NextResponse) {
  res.cookies.delete("hogfarm_pkce");
  res.cookies.delete("hogfarm_state");
  res.cookies.delete("hogfarm_input");
}
