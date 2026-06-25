import { Farm } from "@/lib/db";
import { HOST, validAccessToken } from "@/lib/posthog-token";

// Public, anonymous viewer host per region — where a shared/embedded recording
// is served. Distinct from the provisioning HOST (which is always US here).
const PUBLIC_HOST: Record<string, string> = {
  US: "https://us.posthog.com",
  EU: "https://eu.posthog.com",
};

/**
 * Turn on "Record user sessions" for a freshly provisioned project. New PostHog
 * projects default to opt-in OFF, and the client-side startSessionRecording()
 * can't override that master switch — so without this, no sessions ever record.
 * Needs project:write. Best-effort: returns false rather than throwing.
 */
export async function enableSessionRecording(token: string, teamId: string): Promise<boolean> {
  try {
    const res = await fetch(`${HOST}/api/projects/${teamId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ session_recording_opt_in: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function latestRecordingId(token: string, teamId: string): Promise<string | null> {
  const res = await fetch(`${HOST}/api/projects/${teamId}/query/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      query: {
        kind: "HogQLQuery",
        query: "SELECT session_id FROM raw_session_replay_events ORDER BY max_last_timestamp DESC LIMIT 1",
      },
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return (body.results?.[0]?.[0] as string) ?? null;
}

/**
 * Turn the farm's most recent session recording into an embeddable player URL.
 *
 * Enabling sharing on a recording mints a single public access token; the
 * `/embedded/{token}` page is the only PostHog surface designed to be iframed
 * (the main app sets frame-ancestors and won't embed). This needs
 * `sharing_configuration:write` on the provisioning token — a public, unprivileged
 * scope we request in the CIMD ceiling.
 *
 * Returns null on any miss (no recordings yet, older farm whose token predates
 * the scope, org with public sharing disabled) so the dashboard can fall back.
 *
 * Note: a shared recording is publicly viewable by anyone with the link. Fine for
 * this demo; a production builder would gate or expire these.
 */
export async function getReplayEmbedUrl(farm: Farm): Promise<string | null> {
  try {
    const token = await validAccessToken(farm);
    const recordingId = await latestRecordingId(token, farm.posthogTeamId);
    if (!recordingId) return null;

    const res = await fetch(
      `${HOST}/api/projects/${farm.posthogTeamId}/session_recordings/${recordingId}/sharing/`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: true }),
      },
    );
    if (!res.ok) return null;

    const { access_token } = await res.json();
    if (!access_token) return null;

    const host = PUBLIC_HOST[farm.region] ?? PUBLIC_HOST.US;
    return `${host}/embedded/${access_token}`;
  } catch {
    return null;
  }
}
