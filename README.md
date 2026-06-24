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
| [`lib/pkce.ts`](lib/pkce.ts) | PKCE verifier/challenge. |
| [`app/page.tsx`](app/page.tsx) | The farm-builder UI. |

---

## The two account paths

`account_requests` returns one of two shapes, and a real partner has to handle
both:

- **New email** → `{ type: "oauth", code }`. The account is linked silently; you
  get an authorization code immediately and finish all three steps server-side.
  The user gets a welcome email to set their password.
- **Existing PostHog user** → `{ type: "requires_auth", url }`. That user has to
  consent in the browser first. You send them to `url`; PostHog redirects back to
  your `redirect_uri` with a code. This is also exactly the **"Open in PostHog"**
  deep-link pattern.

HogFarm handles the new-user path inline in `/api/provision`, and the
existing-user path via the redirect in `/api/oauth/callback`.

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
- **Token storage / refresh.** A production partner persists the access + refresh
  tokens per user and refreshes them. HogFarm uses them once and drops them.
- **Idempotency, deprovisioning, list-resources.** All supported by the API;
  omitted here for clarity.

## Reference

- [Provisioning docs](https://posthog.com/docs/integrate/provisioning)
- [OAuth + CIMD docs](https://posthog.com/docs/api/oauth)
