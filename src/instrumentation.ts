import type { Instrumentation } from "next";

/**
 * Server-side instrumentation. Next.js calls `register()` once on cold start
 * and `onRequestError` for every uncaught error thrown during a request.
 *
 * For now we route errors to `console.error` with a structured tag — Vercel
 * surfaces these in runtime logs and (when the Vercel Logs / Drains plan is
 * enabled) forwards them to whatever observability sink the project is
 * configured against.
 *
 * When a third-party error tracker (Sentry, Datadog, etc.) is added later,
 * the `onRequestError` body is the integration point — no other code needs
 * to change.
 */

export function register() {
  // Reserved — Vercel auto-enables OpenTelemetry collection for projects
  // with an `instrumentation.ts` present, even without an explicit setup
  // call. Leaving this empty is intentional.
}

export const onRequestError: Instrumentation.onRequestError = (
  err,
  request,
  context,
) => {
  // Use a single console.error so Vercel's log search can grep by tag.
  // Keep the payload small — full stack stays in `err`, structured fields
  // are appended as a JSON line.
  const safeRequest = {
    path: request.path,
    method: request.method,
  };
  console.error(
    "[dawasarthi:server-error]",
    JSON.stringify({
      message: err instanceof Error ? err.message : String(err),
      digest: (err as { digest?: string })?.digest,
      request: safeRequest,
      context,
    }),
    err instanceof Error ? err.stack : undefined,
  );
};
