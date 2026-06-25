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

async function latestRecordingId(token: string, teamId: string): Promise<{ id: string | null; debug: string }> {
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
  if (!res.ok) return { id: null, debug: `query_${res.status}:${(await res.text()).slice(0, 140)}` };
  const body = await res.json();
  const id = (body.results?.[0]?.[0] as string) ?? null;
  return { id, debug: id ? `recording ${id}` : "no_recording_rows" };
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
export interface ReplayEmbed {
  url: string | null;
  reason: string; // surfaced via ?debug=1 on the dashboard
}

export async function getReplayEmbedUrl(farm: Farm): Promise<ReplayEmbed> {
  try {
    const token = await validAccessToken(farm);
    const { id: recordingId, debug } = await latestRecordingId(token, farm.posthogTeamId);
    if (!recordingId) return { url: null, reason: debug };

    const res = await fetch(
      `${HOST}/api/projects/${farm.posthogTeamId}/session_recordings/${recordingId}/sharing/`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: true }),
      },
    );
    if (!res.ok) return { url: null, reason: `sharing_${res.status}:${(await res.text()).slice(0, 140)}` };

    const { access_token } = await res.json();
    if (!access_token) return { url: null, reason: "sharing_ok_but_no_token" };

    const host = PUBLIC_HOST[farm.region] ?? PUBLIC_HOST.US;
    return { url: `${host}/embedded/${access_token}`, reason: "ok" };
  } catch (e) {
    return { url: null, reason: `error:${String(e).slice(0, 140)}` };
  }
}
