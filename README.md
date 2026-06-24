# 🌾 HogFarm

A toy farm-website builder that provisions PostHog analytics for its users with
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
[`app/.well-known/posthog-client.json/route.ts`](app/.well-known/posthog-client.json/route.ts).
The one rule: `client_id` must exactly equal the URL it's served from.

### How the token exchange stays safe: PKCE

HogFarm is a public client — it holds no secret. It proves the token exchange
with **PKCE** (RFC 7636): generate a random verifier, send only its SHA-256 hash
(`code_challenge`) with the account request, then replay the verifier at token
exchange. See [`lib/pkce.ts`](lib/pkce.ts).

---

## Walk the code

| File | What it does |
| --- | --- |
| [`app/.well-known/posthog-client.json/route.ts`](app/.well-known/posthog-client.json/route.ts) | Serves the CIMD document. This is your registration. |
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
cp .env.example .env   # optional — defaults work
pnpm dev
```

Open http://localhost:3000.

> CIMD requires an HTTPS URL that PostHog can fetch, so the very first
> registration won't complete against `localhost`. To exercise the full
> end-to-end flow, deploy to a public HTTPS URL (see below) or expose localhost
> with a tunnel (`ngrok http 3000`) and it works the same.

## Deploy to Vercel

1. Push this repo to GitHub (already done if you're reading it there).
2. In Vercel, **Add New → Project** and import the repo. No build config needed.
3. Deploy. Your CIMD URL becomes
   `https://<your-deployment>.vercel.app/.well-known/posthog-client.json` — the
   app derives it from the request automatically, no env var required.
4. (Optional) Set `POSTHOG_VERIFICATION_TOKEN` to raise your rate limit.

---

## What's intentionally left out

- **Partner-mediated billing.** Real partners can receive usage + invoices via
  webhook and bill their users directly (the Stripe-shared-payment-token model).
  Out of scope for a v1 demo.
- **Token storage / refresh.** A production partner persists each user's access +
  refresh tokens (encrypted at rest) and refreshes them to keep calling PostHog.
  HogFarm uses the tokens once and persists only the non-secret provisioning
  record (team id, publishable `phc_` key) — see [`lib/db.ts`](lib/db.ts). Storing
  live refresh tokens in a public demo DB isn't worth the exposure.
- **Idempotency, deprovisioning, list-resources.** All supported by the API;
  omitted here for clarity.

## Reference

- [Provisioning docs](https://posthog.com/docs/integrate/provisioning)
- [OAuth + CIMD docs](https://posthog.com/docs/api/oauth)
