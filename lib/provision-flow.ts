import { exchangeToken, createResource, createDeepLink } from "@/lib/posthog-provisioning";
import { saveFarm } from "@/lib/db";

/**
 * Steps 2 and 3 of the flow, shared by both account paths: trade the
 * authorization code for tokens, provision a project, mint the
 * "Open in PostHog" deep link, and persist the result.
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
    labelPrefix: params.farmName,
    projectName: `${params.farmName} site`,
  });

  const deepLink = await createDeepLink(tokens.accessToken).catch(() => null);

  // Persist so HogFarm can call PostHog for this user again later. No-op if no
  // DATABASE_URL is configured.
  await saveFarm({
    farmName: params.farmName,
    email: params.email,
    posthogTeamId: resource.teamId,
    projectApiKey: resource.apiKey,
    region: params.region ?? "US",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  }).catch((err) => console.error("saveFarm failed:", err));

  return {
    projectApiKey: resource.apiKey,
    posthogHost: resource.host,
    teamId: resource.teamId,
    openInPostHog: deepLink,
  };
}
