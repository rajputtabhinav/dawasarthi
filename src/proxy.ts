import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes that REQUIRE authentication. Per-route handlers add admin / ownership
 * checks on top of this; the middleware adds a defence-in-depth layer that
 * blocks unauthenticated requests outright before they reach the handler.
 */
const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/account(.*)",
  "/checkout(.*)",
  "/track-order(.*)",
  "/api/orders(.*)",
  "/api/prescriptions(.*)",
  "/api/isa(.*)",
]);

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://clerk.dawasarthi.com https://*.clerk.accounts.dev",
    // Mapbox GL JS uses a Web Worker built from blob: URLs.
    // Cloudflare Turnstile is Clerk's bot challenge — it both loads JS and is
    // embedded as an iframe (see frame-src below).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' blob: https://clerk.dawasarthi.com https://*.clerk.com https://*.clerk.accounts.dev https://api.mapbox.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
    // Mapbox tiles + Clerk avatars + data/blob for our marker DOM nodes.
    "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://api.mapbox.com https://*.tiles.mapbox.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://clerk.dawasarthi.com https://*.clerk.com https://*.clerk.accounts.dev https://api.clerk.com https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com",
    "worker-src 'self' blob:",
    "frame-src https://clerk.dawasarthi.com https://*.clerk.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export const proxy = clerkMiddleware(async (auth, req: NextRequest) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Generate a fresh nonce per request and forward it to the route handler
  // via a request header so RSCs can read it from `await headers()`.
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64",
  );

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", buildCsp(nonce));

  return response;
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
