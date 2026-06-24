import { neon } from "@neondatabase/serverless";

/**
 * Persistence for provisioned farms.
 *
 * A real provisioning partner stores, per user, the tokens and project key it
 * got back so it can keep calling PostHog on their behalf (refresh tokens, mint
 * deep links, read analytics). HogFarm does the same, in a dedicated `hogfarm`
 * Postgres schema so it never collides with anything else in the database.
 *
 * Persistence is optional: with no DATABASE_URL the app still runs the full
 * provisioning flow, it just doesn't remember the result.
 */

const SCHEMA = "hogfarm";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

export const isDbEnabled = Boolean(connectionString);

const sql = connectionString ? neon(connectionString) : null;

export interface ProvisionedFarm {
  farmName: string;
  email: string;
  posthogTeamId: string;
  projectApiKey: string;
  region: string;
  // Tokens let us call PostHog again later. In production these must be
  // encrypted at rest; kept plain here only to keep the example readable.
  accessToken: string;
  refreshToken: string;
}

// SCHEMA is a hardcoded constant, never user input, so inlining it into the DDL
// below is safe. All runtime values go through tagged-template bind parameters.
export async function ensureSchema(): Promise<void> {
  if (!sql) return;
  await sql`CREATE SCHEMA IF NOT EXISTS hogfarm`;
  await sql`
    CREATE TABLE IF NOT EXISTS hogfarm.provisioned_farms (
      id              BIGSERIAL PRIMARY KEY,
      farm_name       TEXT NOT NULL,
      email           TEXT NOT NULL,
      posthog_team_id TEXT NOT NULL,
      project_api_key TEXT NOT NULL,
      region          TEXT NOT NULL DEFAULT 'US',
      access_token    TEXT NOT NULL,
      refresh_token   TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS provisioned_farms_email_team
    ON hogfarm.provisioned_farms (email, posthog_team_id)
  `;
}

export async function saveFarm(farm: ProvisionedFarm): Promise<void> {
  if (!sql) return;
  await ensureSchema();
  // Re-provisioning the same email+team updates the stored tokens rather than
  // duplicating the row.
  await sql`
    INSERT INTO hogfarm.provisioned_farms
      (farm_name, email, posthog_team_id, project_api_key, region, access_token, refresh_token)
    VALUES (${farm.farmName}, ${farm.email}, ${farm.posthogTeamId}, ${farm.projectApiKey},
            ${farm.region}, ${farm.accessToken}, ${farm.refreshToken})
    ON CONFLICT (email, posthog_team_id)
    DO UPDATE SET access_token = EXCLUDED.access_token,
                  refresh_token = EXCLUDED.refresh_token,
                  project_api_key = EXCLUDED.project_api_key
  `;
}

export async function countFarms(): Promise<number | null> {
  if (!sql) return null;
  await ensureSchema();
  const rows = (await sql`SELECT count(*)::int AS n FROM hogfarm.provisioned_farms`) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}
