import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { clientId } from "@/lib/client-id";
import { createPkce } from "@/lib/pkce";
import { createAccountRequest, ProvisioningError } from "@/lib/posthog-provisioning";
import { finishProvisioning } from "@/lib/provision-flow";

// Scopes HogFarm wants on its users' behalf — enough to read analytics back
// into our own dashboard. Kept under the ceiling declared in the CIMD doc.
const SCOPES = ["insight:read", "project:read", "person:read"];

export async function POST(request: NextRequest) {
  const { email, name, farmName } = await request.json();

  if (!email || !farmName) {
    return NextResponse.json({ error: "email and farmName are required" }, { status: 400 });
  }

  const pkce = createPkce();

  try {
    // Step 1 — create or locate the account.
    const account = await createAccountRequest({
      id: randomUUID(),
      email,
      name: name || email,
      clientId: clientId(request),
      codeChallenge: pkce.challenge,
      scopes: SCOPES,
      region: "US",
      organizationName: farmName,
    });

    // Existing PostHog user: they must consent in the browser. Stash the PKCE
    // verifier in an httpOnly cookie and hand the consent URL to the frontend.
    if (account.type === "requires_auth") {
      const res = NextResponse.json({ status: "requires_auth", url: account.url });
      res.cookies.set("hogfarm_pkce", pkce.verifier, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
      res.cookies.set("hogfarm_farm", farmName, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
      return res;
    }

    // New user: we already have the code. Finish all three steps server-side.
    const result = await finishProvisioning(account.code, pkce.verifier, farmName);
    return NextResponse.json({ status: "complete", ...result });
  } catch (err) {
    if (err instanceof ProvisioningError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    throw err;
  }
}
