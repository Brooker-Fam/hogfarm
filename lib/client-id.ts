import { NextRequest } from "next/server";

/**
 * Derive our public origin from the incoming request so the same code works on
 * localhost, Vercel previews, and production without per-environment config.
 *
 * CIMD requires the client_id to be the exact URL the metadata document is
 * served from, so origin detection has to be correct. We honor the standard
 * forwarded headers Vercel sets in front of us.
 */
export function origin(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

// Versioned so a scope-ceiling change re-registers as a fresh CIMD client.
// PostHog locks an app's allowed scopes at first registration, so widening the
// ceiling means a new client_id, not an edit to the existing document.
export function clientId(request: NextRequest): string {
  return `${origin(request)}/.well-known/posthog-client-v2.json`;
}

// Cookies are Secure on HTTPS (Vercel) but not on plain-HTTP localhost, where a
// browser would otherwise silently drop them and break the consent flow.
export function shortLivedCookieOpts(request: NextRequest) {
  return {
    httpOnly: true,
    secure: origin(request).startsWith("https"),
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
}
