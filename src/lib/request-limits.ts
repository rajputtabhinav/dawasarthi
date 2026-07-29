import { NextResponse } from "next/server";

/**
 * Allowed origins for state-changing requests. Used by `enforceSameOrigin`
 * to reject cross-origin POST/PATCH/DELETE attacks that bypass preflight
 * (e.g. multipart/form-data simple requests).
 */
function getAllowedOrigins(): string[] {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const fromVercel = process.env.VERCEL_URL?.trim();
  const list = new Set<string>();
  if (fromEnv) list.add(fromEnv);
  if (fromVercel) list.add(`https://${fromVercel}`);
  // Common deployments / local dev
  list.add("https://dawasarthi.com");
  list.add("https://www.dawasarthi.com");
  list.add("http://localhost:3000");
  list.add("http://127.0.0.1:3000");
  return Array.from(list);
}

/**
 * For mutating requests, require the `Origin` header (or `Referer` fallback)
 * to match a configured site origin. Defeats CSRF where a victim's browser
 * is tricked into submitting a multipart form from another site.
 *
 * Same-site fetches from this app always set `Origin: <our origin>`.
 */
export function enforceSameOrigin(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowed = getAllowedOrigins();

  if (origin) {
    if (allowed.includes(origin)) return null;
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  }

  // Some browsers omit Origin on same-origin POSTs; fall back to Referer.
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (allowed.includes(refOrigin)) return null;
    } catch {
      /* fall through */
    }
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 },
    );
  }

  // No Origin and no Referer → reject for unsafe methods.
  return NextResponse.json(
    { error: "Missing Origin header on a state-changing request." },
    { status: 403 },
  );
}

/**
 * Reject requests that declare (or carry) a body larger than `maxBytes`.
 * Returns a 413 NextResponse if rejected, otherwise null.
 *
 * For requests without Content-Length (chunked uploads), the route handler
 * should additionally cap the stream — but for JSON / multipart from a browser,
 * Content-Length is reliable.
 */
export function enforceContentLength(
  request: Request,
  maxBytes: number,
): NextResponse | null {
  const header = request.headers.get("content-length");
  if (!header) return null;
  const n = Number(header);
  if (!Number.isFinite(n)) return null;
  if (n > maxBytes) {
    return NextResponse.json(
      { error: "Request body too large." },
      {
        status: 413,
        headers: { "Connection": "close" },
      },
    );
  }
  return null;
}

/** Convenience sizes. */
export const BODY_LIMIT_JSON_SMALL = 32 * 1024; // 32 KB — orders, lookups, chat
export const BODY_LIMIT_JSON_MEDIUM = 256 * 1024; // 256 KB — medicine admin payloads
export const BODY_LIMIT_JSON_LARGE = 2 * 1024 * 1024; // 2 MB — medicine with data-URL image
export const BODY_LIMIT_MULTIPART_PRESCRIPTION = 6 * 1024 * 1024; // 6 MB — prescription file (server enforces 5 MB after parse)
