import { neon } from "@neondatabase/serverless";

/**
 * Persistence for HogFarm sites, in a dedicated `hogfarm` Postgres schema so it
 * never collides with anything else sharing the database.
 *
 * Unlike the throwaway first version, this stores each farm's OAuth tokens so we
 * can pull their analytics back over time — encrypted at rest (see lib/crypto).
 */

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
export const isDbEnabled = Boolean(connectionString);
const sql = connectionString ? neon(connectionString) : null;

export interface Farm {
  slug: string;
  name: string;
  ownerName: string;
  email: string;
  tagline: string;
  location: string;
  products: string[];
  theme: string;
  posthogTeamId: string;
  projectApiKey: string; // phc_… — publishable
  region: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiry: Date;
}

export async function ensureSchema(): Promise<void> {
  if (!sql) return;
  await sql`CREATE SCHEMA IF NOT EXISTS hogfarm`;
  await sql`
    CREATE TABLE IF NOT EXISTS hogfarm.farms (
      id                BIGSERIAL PRIMARY KEY,
      slug              TEXT NOT NULL UNIQUE,
      name              TEXT NOT NULL,
      owner_name        TEXT NOT NULL DEFAULT '',
      email             TEXT NOT NULL,
      tagline           TEXT NOT NULL DEFAULT '',
      location          TEXT NOT NULL DEFAULT '',
      products          JSONB NOT NULL DEFAULT '[]',
      theme             TEXT NOT NULL DEFAULT 'meadow',
      posthog_team_id   TEXT NOT NULL,
      project_api_key   TEXT NOT NULL,
      region            TEXT NOT NULL DEFAULT 'US',
      access_token_enc  TEXT NOT NULL,
      refresh_token_enc TEXT NOT NULL,
      token_expiry      TIMESTAMPTZ NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

function rowToFarm(r: Record<string, unknown>): Farm {
  return {
    slug: r.slug as string,
    name: r.name as string,
    ownerName: r.owner_name as string,
    email: r.email as string,
    tagline: r.tagline as string,
    location: r.location as string,
    products: (r.products as string[]) ?? [],
    theme: r.theme as string,
    posthogTeamId: r.posthog_team_id as string,
    projectApiKey: r.project_api_key as string,
    region: r.region as string,
    accessTokenEnc: r.access_token_enc as string,
    refreshTokenEnc: r.refresh_token_enc as string,
    tokenExpiry: new Date(r.token_expiry as string),
  };
}

export async function createFarm(farm: Farm): Promise<void> {
  if (!sql) throw new Error("DATABASE_URL not configured");
  await ensureSchema();
  await sql`
    INSERT INTO hogfarm.farms
      (slug, name, owner_name, email, tagline, location, products, theme,
       posthog_team_id, project_api_key, region, access_token_enc, refresh_token_enc, token_expiry)
    VALUES (${farm.slug}, ${farm.name}, ${farm.ownerName}, ${farm.email}, ${farm.tagline},
            ${farm.location}, ${JSON.stringify(farm.products)}, ${farm.theme},
            ${farm.posthogTeamId}, ${farm.projectApiKey}, ${farm.region},
            ${farm.accessTokenEnc}, ${farm.refreshTokenEnc}, ${farm.tokenExpiry.toISOString()})
  `;
}

export async function getFarmBySlug(slug: string): Promise<Farm | null> {
  if (!sql) return null;
  await ensureSchema();
  const rows = (await sql`SELECT * FROM hogfarm.farms WHERE slug = ${slug} LIMIT 1`) as Record<string, unknown>[];
  return rows[0] ? rowToFarm(rows[0]) : null;
}

export async function slugExists(slug: string): Promise<boolean> {
  if (!sql) return false;
  await ensureSchema();
  const rows = (await sql`SELECT 1 FROM hogfarm.farms WHERE slug = ${slug} LIMIT 1`) as unknown[];
  return rows.length > 0;
}

export async function updateTokens(
  slug: string,
  accessTokenEnc: string,
  refreshTokenEnc: string,
  tokenExpiry: Date,
): Promise<void> {
  if (!sql) return;
  await sql`
    UPDATE hogfarm.farms
    SET access_token_enc = ${accessTokenEnc}, refresh_token_enc = ${refreshTokenEnc},
        token_expiry = ${tokenExpiry.toISOString()}
    WHERE slug = ${slug}
  `;
}
