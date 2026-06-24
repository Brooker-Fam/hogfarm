import { exchangeToken, createResource } from "@/lib/posthog-provisioning";
import { saveFarm } from "@/lib/db";

/**
 * Steps 2 and 3 of the flow, shared by both account paths: trade the
 * authorization code for tokens, provision a project, and persist the result.
 *
 * The "Open in PostHog" link is handled separately via the requires_auth
 * handshake (see app/api/open-in-posthog), which any CIMD partner can use. The
 * privileged /deep_links magic-login endpoint needs PostHog to enable it per
 * partner, so we don't depend on it here.
 */
export async function finishProvisioning(params: {
  code: string;
  verifier: string;
  farmName: string;
  email: string;
  region?: string;
}) {
  const tokens = await exchangeToken(params.code, params.verifier);

  const resource = await createResource({
    accessToken: tokens.accessToken,
    serviceId: "free",
    // label_prefix is capped at 25 chars by the API; trim defensively.
    labelPrefix: params.farmName.slice(0, 25),
    projectName: `${params.farmName} site`,
  });

  // Persist the provisioning record. No-op if no DATABASE_URL is configured.
  await saveFarm({
    farmName: params.farmName,
    email: params.email,
    posthogTeamId: resource.teamId,
    projectApiKey: resource.apiKey,
    region: params.region ?? "US",
  }).catch((err) => console.error("saveFarm failed:", err));

  return {
    projectApiKey: resource.apiKey,
    posthogHost: resource.host,
    teamId: resource.teamId,
  };
}
