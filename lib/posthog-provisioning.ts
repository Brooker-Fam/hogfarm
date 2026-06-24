/**
 * A small, typed client for the PostHog agentic provisioning API.
 *
 * The whole partner integration is three calls:
 *   1. account_requests  -> an OAuth authorization code (or a consent URL)
 *   2. oauth/token       -> access + refresh tokens
 *   3. resources         -> a project API key your user's app sends events with
 *
 * Auth model: this app is a public CIMD client. We never hold a secret. We
 * identify ourselves by hosting a metadata document at our own URL and passing
 * that URL as `client_id`, and we prove the token exchange with PKCE.
 *
 * Docs: https://posthog.com/docs/integrate/provisioning
 */

const HOST = process.env.POSTHOG_PROVISIONING_HOST ?? "https://us.posthog.com";
const API_VERSION = "0.1d";

export type Region = "US" | "EU";

// account_requests returns one of two shapes. A brand-new email is linked
// silently and we get an authorization code back. An email that already
// belongs to a PostHog user requires that user to consent in the browser
// first, so we get a URL to send them to instead.
export type AccountRequestResult =
  | { type: "oauth"; code: string }
  | { type: "requires_auth"; url: string };

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  availableTeams: Array<{
    id: number;
    name: string;
    organization_id: string;
    organization_name: string;
  }>;
}

export interface ProvisionedResource {
  teamId: string;
  apiKey: string; // phc_... — the project token the end user's site sends events with
  host: string;
}

class ProvisioningError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProvisioningError";
  }
}

async function parseError(res: Response): Promise<ProvisioningError> {
  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  // Provisioning endpoints use { error: { code, message } }; the token endpoint
  // uses the OAuth { error, error_description } shape. Handle both.
  const err = (body as any).error;
  if (err && typeof err === "object") {
    return new ProvisioningError(res.status, err.code ?? "error", err.message ?? res.statusText);
  }
  return new ProvisioningError(res.status, err ?? "error", (body as any).error_description ?? res.statusText);
}

/**
 * Step 1. Ask PostHog to create (or locate) an account for this email.
 *
 * @param clientId  Our CIMD URL. Must exactly match where we host the metadata
 *                  document, e.g. https://hogfarm.vercel.app/.well-known/posthog-client.json
 */
export async function createAccountRequest(params: {
  id: string;
  email: string;
  name: string;
  clientId: string;
  codeChallenge: string;
  scopes: string[];
  region?: Region;
  organizationName?: string;
}): Promise<AccountRequestResult> {
  const res = await fetch(`${HOST}/api/agentic/provisioning/account_requests`, {
    method: "POST",
    headers: { "API-Version": API_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: params.id,
      email: params.email,
      name: params.name,
      client_id: params.clientId,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256",
      scopes: params.scopes,
      configuration: {
        region: params.region ?? "US",
        organization_name: params.organizationName,
      },
    }),
  });

  // First-ever request from a new CIMD client: PostHog fetches our metadata
  // document in the background and tells us to retry shortly.
  if (res.status === 202) {
    const body = await res.json().catch(() => ({}) as any);
    throw new ProvisioningError(202, "registering", `Client registering, retry after ${body.retry_after ?? 5}s`);
  }

  if (!res.ok) throw await parseError(res);

  const body = await res.json();
  if (body.type === "oauth") return { type: "oauth", code: body.oauth.code };
  if (body.type === "requires_auth") return { type: "requires_auth", url: body.requires_auth.url };
  throw new ProvisioningError(res.status, "unexpected_response", `Unexpected account_requests type: ${body.type}`);
}

/** Step 2. Exchange the authorization code for tokens, proving PKCE ownership. */
export async function exchangeToken(code: string, codeVerifier: string): Promise<TokenResult> {
  const res = await fetch(`${HOST}/api/agentic/oauth/token`, {
    method: "POST",
    headers: { "API-Version": API_VERSION, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) throw await parseError(res);

  const body = await res.json();
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
    availableTeams: body.account?.available_teams ?? [],
  };
}

/** Step 3. Provision a project and get back the API key the end user sends events with. */
export async function createResource(params: {
  accessToken: string;
  serviceId?: "analytics" | "free" | "pay_as_you_go";
  labelPrefix: string;
  projectName: string;
}): Promise<ProvisionedResource> {
  const res = await fetch(`${HOST}/api/agentic/provisioning/resources`, {
    method: "POST",
    headers: {
      "API-Version": API_VERSION,
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      service_id: params.serviceId ?? "free",
      label_prefix: params.labelPrefix,
      configuration: { project_name: params.projectName },
    }),
  });

  if (!res.ok) throw await parseError(res);

  const body = await res.json();
  const access = body.complete?.access_configuration ?? {};
  return { teamId: String(body.id), apiKey: access.api_key, host: access.host };
}

/**
 * Generate a single-use link that drops the user straight into their PostHog
 * project, already logged in (a magic login).
 *
 * Note: this privileged endpoint must be enabled by PostHog per partner and
 * returns 403 `deep_links_not_enabled` otherwise. For a self-registered CIMD
 * partner, prefer the requires_auth handshake (see openInPostHogUrl) for the
 * "Open in PostHog" button — it needs no special enablement.
 */
export async function createDeepLink(accessToken: string, purpose = "dashboard"): Promise<string> {
  const res = await fetch(`${HOST}/api/agentic/provisioning/deep_links`, {
    method: "POST",
    headers: {
      "API-Version": API_VERSION,
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ purpose }),
  });

  if (!res.ok) throw await parseError(res);
  const body = await res.json();
  return body.url;
}

export { ProvisioningError };
