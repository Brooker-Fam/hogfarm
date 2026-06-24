import { exchangeToken, createResource, createDeepLink } from "@/lib/posthog-provisioning";

/**
 * Steps 2 and 3 of the flow, shared by both account paths: trade the
 * authorization code for tokens, provision a project, and mint the
 * "Open in PostHog" deep link.
 */
export async function finishProvisioning(code: string, verifier: string, farmName: string) {
  const tokens = await exchangeToken(code, verifier);

  const resource = await createResource({
    accessToken: tokens.accessToken,
    serviceId: "free",
    labelPrefix: farmName,
    projectName: `${farmName} site`,
  });

  const deepLink = await createDeepLink(tokens.accessToken).catch(() => null);

  return {
    projectApiKey: resource.apiKey,
    posthogHost: resource.host,
    teamId: resource.teamId,
    openInPostHog: deepLink,
  };
}
