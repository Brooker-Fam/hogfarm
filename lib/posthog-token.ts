import { Farm, updateTokens } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/posthog-provisioning";

export const HOST = process.env.POSTHOG_PROVISIONING_HOST ?? "https://us.posthog.com";

/**
 * Return a usable access token for this farm, refreshing and persisting if the
 * stored one is within a minute of expiring. Refresh tokens rotate, so we write
 * the new pair straight back.
 */
export async function validAccessToken(farm: Farm): Promise<string> {
  const fresh = farm.tokenExpiry.getTime() - Date.now() > 60_000;
  if (fresh) return decrypt(farm.accessTokenEnc);

  const tokens = await refreshAccessToken(decrypt(farm.refreshTokenEnc));
  await updateTokens(
    farm.slug,
    encrypt(tokens.accessToken),
    encrypt(tokens.refreshToken),
    new Date(Date.now() + tokens.expiresIn * 1000),
  );
  return tokens.accessToken;
}
