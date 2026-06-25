import { NextRequest, NextResponse } from "next/server";
import { clientId, origin } from "@/lib/client-id";

/**
 * The CIMD (Client ID Metadata Document). This is how a partner registers with
 * PostHog: there is no signup form. We host this document at a stable HTTPS URL,
 * and that URL *is* our client_id. On our first provisioning call PostHog fetches
 * this document, validates it, and auto-creates our OAuth application.
 *
 * Hard requirement: `client_id` below must exactly equal the URL this is served
 * from, and every redirect_uri must be HTTPS.
 *
 * https://posthog.com/docs/api/oauth
 */
export function GET(request: NextRequest) {
  const base = origin(request);

  return NextResponse.json({
    client_id: clientId(request),
    client_name: "HogFarm",
    client_uri: base,
    logo_uri: `${base}/logo.png`,
    redirect_uris: [`${base}/api/oauth/callback`],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
    "com.posthog": {
      // A verification token (minted in your PostHog org settings) links this
      // client to your org and lifts the unverified rate limit from 10/hr to
      // 100/hr. Optional — omit it and you still work, just throttled lower.
      verification_token: process.env.POSTHOG_VERIFICATION_TOKEN || undefined,
      // Optional scope ceiling. Tokens issued to this client can never exceed
      // these, regardless of what an individual account request asks for.
      // query:read runs HogQL for the dashboard; sharing_configuration:write mints
      // the public embed token for inline session-replay playback; project:write
      // turns on session recording for a freshly provisioned project.
      scopes: [
        "query:read",
        "insight:read",
        "project:read",
        "person:read",
        "session_recording:read",
        "sharing_configuration:write",
        "project:write",
      ],
    },
  });
}
