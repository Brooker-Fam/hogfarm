import { NextRequest, NextResponse } from "next/server";
import { finishProvisioning } from "@/lib/provision-flow";

/**
 * Redirect target for the existing-user consent flow. PostHog sends the user
 * back here with an authorization code once they approve the consent screen.
 * We recover the PKCE verifier we stashed before the redirect and finish the
 * same three-step flow as the new-user path.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const verifier = request.cookies.get("hogfarm_pkce")?.value;
  const farmName = request.cookies.get("hogfarm_farm")?.value ?? "Your farm";

  if (!code || !verifier) {
    return NextResponse.redirect(new URL("/?error=missing_code", request.url));
  }

  const result = await finishProvisioning(code, verifier, farmName);

  // Hand the result to the home page. The API key here is a publishable project
  // token (phc_), safe to expose to the browser — that is what SDKs ship with.
  const url = new URL("/", request.url);
  url.searchParams.set("status", "complete");
  url.searchParams.set("apiKey", result.projectApiKey);
  url.searchParams.set("host", result.posthogHost);
  if (result.openInPostHog) url.searchParams.set("openInPostHog", result.openInPostHog);

  const res = NextResponse.redirect(url);
  res.cookies.delete("hogfarm_pkce");
  res.cookies.delete("hogfarm_farm");
  return res;
}
