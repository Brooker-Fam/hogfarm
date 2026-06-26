# 🌾 HogFarm

A farm-website builder that provisions PostHog analytics for its users with
zero manual setup. It's a **reference implementation of the PostHog [agentic
provisioning API](https://posthog.com/docs/integrate/provisioning)** — the thing
partners like Insforge, Expo, and Replit use to spin up PostHog accounts for
their own users.

A HogFarm user types in their farm name and email, clicks one button, and gets a
live PostHog project wired into their site — without ever seeing a PostHog signup
page. This repo shows exactly how that works, end to end.

> This is a teaching example, not production code. It keeps everything in one
> small Next.js app so the whole flow is readable in a sitting.

---

## The whole integration is three API calls

```
1. POST /api/agentic/provisioning/account_requests   → authorization code
2. POST /api/agentic/oauth/token                      → access + refresh tokens
3. POST /api/agentic/provisioning/resources           → project API key (phc_…)
```

Everything else (CIMD, PKCE, deep links) is the plumbing that makes those three
calls safe to make from a public client.

### How a partner identifies itself: CIMD

There is no partner signup form. You host a **Client ID Metadata Document** at a
stable HTTPS URL, and that URL *is* your `client_id`. On your first provisioning
call, PostHog fetches the document, validates it, and auto-registers your OAuth
app.

In this repo that document is served from
[`app/.well-known/posthog-client-v5.json/route.ts`](app/.well-known/posthog-client-v5.json/route.ts).
The one rule: `client_id` must exactly equal the URL it's served from.

#### Why the filename is versioned

PostHog locks a client's allowed scopes at first registration. To widen the
scope ceiling you can't edit the existing document — you mint a new `client_id`,
which means a new versioned filename (`-v5.json`). The earlier `-v#` documents
are retired; v5 is the live one. See the note in [`lib/client-id.ts`](lib/client-id.ts).

### How the token exchange stays safe: PKCE

HogFarm is a public client — it holds no secret. It proves the token exchange
with **PKCE** (RFC 7636): generate a random verifier, send only its SHA-256 hash
(`code_challenge`) with the account request, then replay the verifier at token
exchange. See [`lib/pkce.ts`](lib/pkce.ts).

---

## Walk the code

| File | What it does |
| --- | --- |
| [`app/.well-known/posthog-client-v5.json/route.ts`](app/.well-known/posthog-client-v5.json/route.ts) | Serves the CIMD document. This is your registration. |
| [`lib/posthog-provisioning.ts`](lib/posthog-provisioning.ts) | Typed client for the three calls + deep links. Start here. |
| [`app/api/provision/route.ts`](app/api/provision/route.ts) | Orchestrates the flow when a user clicks "Create my farm site". |
| [`app/api/oauth/callback/route.ts`](app/api/oauth/callback/route.ts) | Completes the flow for users who already have a PostHog account. |
| [`lib/db.ts`](lib/db.ts) | Optional Neon persistence in a namespaced `hogfarm` schema. |
| [`lib/pkce.ts`](lib/pkce.ts) | PKCE verifier/challenge. |
| [`app/page.tsx`](app/page.tsx) | The farm-builder UI. |

---

## The two account paths

`account_requests` returns one of these shapes, and a real partner has to handle
each:

- **New email** → `{ type: "oauth", code }`. The account is linked silently; you
  get an authorization code immediately and finish all three steps server-side.
  The user gets a welcome email to set their password.
- **Existing PostHog user** → `{ type: "requires_auth", url }`. That user has to
  consent in the browser first. You send them to `url`; PostHog redirects back to
  your `redirect_uri` with a code.
- **First-ever call from a new CIMD client** → HTTP 202 `{ type: "registering" }`.
  PostHog is fetching your metadata document in the background; wait `retry_after`
  seconds and call again. You'll hit this exactly once per deployment.

HogFarm handles the new-user path inline in `/api/provision`, and the
existing-user path via the redirect in `/api/oauth/callback`.

### "Open in PostHog"

After provisioning, HogFarm links the user straight to their project at
`{host}/project/{teamId}` (PostHog prompts login if they aren't signed in yet).
Simple and reliable for any partner.

For a seamless **no-login** deep link, PostHog has two richer options, neither of
which a freshly self-registered CIMD partner gets for free:

- The privileged `/deep_links` endpoint mints a single-use magic login (no
  consent screen). It must be enabled by PostHog per partner — it returns 403
  `deep_links_not_enabled` otherwise. `createDeepLink` is in the client for
  reference.
- The `requires_auth` handshake (re-run `account_requests`, send the user to the
  returned consent URL) lands them in their project after a quick login/consent.

We keep the demo on the plain project link to stay dependency-free.

---

## Run it locally

```bash
pnpm install
cp .env.example .env   # then fill in the two required vars below
pnpm dev
```

Open http://localhost:3000.

Two env vars are **required** to run the provisioning flow — it throws without
either:

- `DATABASE_URL` — a Neon serverless Postgres connection string. Each provisioned
  farm is persisted here; [`lib/db.ts`](lib/db.ts) throws `DATABASE_URL not
  configured` otherwise.
- `HOGFARM_ENC_KEY` — a hex key used to encrypt stored OAuth tokens and sign
  dashboard capability links. Generate with `openssl rand -hex 32`;
  [`lib/crypto.ts`](lib/crypto.ts) throws `HOGFARM_ENC_KEY is not set` otherwise.

> CIMD requires an HTTPS URL that PostHog can fetch, so the very first
> registration won't complete against `localhost`. To exercise the full
> end-to-end flow, deploy to a public HTTPS URL (see below) or expose localhost
> with a tunnel (`ngrok http 3000`) and it works the same.

## Deploy to Vercel

1. Push this repo to GitHub (already done if you're reading it there).
2. In Vercel, **Add New → Project** and import the repo. No build config needed.
3. Deploy. Your CIMD URL becomes
   `https://<your-deployment>.vercel.app/.well-known/posthog-client-v5.json` — the
   app derives it from the request automatically, no env var required.
4. Set `DATABASE_URL` and `HOGFARM_ENC_KEY` (required — see above).
5. (Optional) Set `POSTHOG_VERIFICATION_TOKEN` to raise your rate limit.

---

## Production differences

What this demo does versus what a production build would add:

- **Dashboard access control.** Each farm's dashboard *is* gated: it's reachable
  only via an unguessable signed capability link — an HMAC of the slug under
  `HOGFARM_ENC_KEY`, carried as a `?k=` query param and issued at provisioning
  time (see [`lib/dashboard-auth.ts`](lib/dashboard-auth.ts)). A farm's analytics
  are private to whoever holds that link. The gaps a production build would close:
  there's no real user login, the capability link doesn't expire or rotate, and
  the token rides in the URL (so it can leak via referrer or browser history).
- **Token refresh.** HogFarm persists each farm's access + refresh tokens
  encrypted at rest ([`lib/crypto.ts`](lib/crypto.ts), [`lib/db.ts`](lib/db.ts))
  so it can read analytics back over time, but it doesn't yet refresh them when
  they expire — a production partner would.
- **Partner-mediated billing.** Real partners can receive usage + invoices via
  webhook and bill their users directly (the Stripe-shared-payment-token model).
  Out of scope for this demo.
- **Idempotency, deprovisioning, list-resources.** All supported by the API;
  omitted here for clarity. Re-submitting the form provisions a fresh project.
- **Public embed link.** The inline session-replay player on the dashboard uses a
  public sharing token, which is intentionally unauthenticated.

This stays a teaching example — it runs against a demo database and isn't meant
to be hardened for production.

## Reference

- [Provisioning docs](https://posthog.com/docs/integrate/provisioning)
- [OAuth + CIMD docs](https://posthog.com/docs/api/oauth)
