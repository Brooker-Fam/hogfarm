import { exchangeToken, createResource } from "@/lib/posthog-provisioning";
import { createFarm } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { uniqueSlug } from "@/lib/slug";
import { seedTraffic } from "@/lib/seed-traffic";

export interface FarmInput {
  name: string;
  ownerName: string;
  email: string;
  tagline: string;
  location: string;
  products: string[];
}

const THEMES = ["meadow", "harvest", "berry", "coastal"];

function pickTheme(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return THEMES[h % THEMES.length];
}

/**
 * Steps 2–3 of provisioning, then build the actual product: a published farm
 * site and a project seeded with a week of traffic so the dashboard isn't empty.
 * Returns the new site's slug.
 */
export async function finishProvisioning(params: {
  code: string;
  verifier: string;
  input: FarmInput;
  region: string;
  origin: string;
}): Promise<{ slug: string }> {
  const { input, region, origin } = params;

  const tokens = await exchangeToken(params.code, params.verifier);

  const resource = await createResource({
    accessToken: tokens.accessToken,
    serviceId: "free",
    labelPrefix: input.name.slice(0, 25),
    projectName: `${input.name} site`,
  });

  const slug = await uniqueSlug(input.name);
  const siteUrl = `${origin}/sites/${slug}`;

  // Seed a believable week of demo traffic. Don't fail provisioning if it errors.
  await seedTraffic(resource.apiKey, region, siteUrl).catch((err) => console.error("seedTraffic failed:", err));

  await createFarm({
    slug,
    name: input.name,
    ownerName: input.ownerName,
    email: input.email,
    tagline: input.tagline,
    location: input.location,
    products: input.products,
    theme: pickTheme(slug),
    posthogTeamId: resource.teamId,
    projectApiKey: resource.apiKey,
    region,
    accessTokenEnc: encrypt(tokens.accessToken),
    refreshTokenEnc: encrypt(tokens.refreshToken),
    tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
  });

  return { slug };
}
