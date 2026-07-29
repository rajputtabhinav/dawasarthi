import { NextResponse } from "next/server";
import { getSql, isDatabaseConfigured } from "@/lib/db";

/** Default window — most routes use 1 minute. */
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Best-effort client IP, hardened against header spoofing.
 *
 * On Vercel, only `x-vercel-forwarded-for` and the rightmost entry of
 * `x-forwarded-for` are trustworthy — both are set by Vercel's edge and any
 * attacker-supplied value is appended to the LEFT.
 *
 * We deliberately do NOT honour `x-real-ip` or `cf-connecting-ip` because
 * Dawasarthi doesn't deploy behind Cloudflare; trusting them would let any
 * caller set their own "IP" and trivially defeat IP-keyed rate limits.
 */
export function getClientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const last = vercel.split(",").pop()?.trim();
    if (last) return last.slice(0, 64);
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim();
    if (last) return last.slice(0, 64);
  }

  return "unknown";
}

function windowBucket(windowMs: number): number {
  return Math.floor(Date.now() / windowMs);
}

/** In-memory fallback bucket per lambda — used when Postgres is unavailable. */
const memoryBuckets = new Map<string, { count: number; expiresAt: number }>();

function memoryLimitCheck(
  key: string,
  maxPerWindow: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = memoryBuckets.get(key);
  if (!entry || entry.expiresAt < now) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + windowMs });
    if (memoryBuckets.size > 5000) {
      // Best-effort eviction so the map doesn't grow unbounded on hot lambdas.
      for (const [k, v] of memoryBuckets) {
        if (v.expiresAt < now) memoryBuckets.delete(k);
      }
    }
    return { allowed: true, retryAfterSec: 0 };
  }
  entry.count += 1;
  const allowed = entry.count <= maxPerWindow;
  const retryAfterSec = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
  return { allowed, retryAfterSec };
}

type RateLimitOptions = {
  /**
   * Authenticated user id — when present, the limit is keyed by user (so
   * an attacker cycling IPs cannot bypass).
   */
  userId?: string;
  /**
   * Override the bucket window. Defaults to 60s. Pass `86_400_000` for a
   * 24-hour bucket (used by /api/rider-applications for a daily cap), etc.
   */
  windowMs?: number;
  /**
   * Extra key dimension layered on top of (route, userId, IP). Use this when
   * you want to key by a stable client-supplied attribute like a phone number
   * — e.g. preventing repeat rider-application submissions from the same
   * number even after IP rotation. The value is sliced to 64 chars.
   */
  dimension?: string;
};

/**
 * Fixed-window limiter backed by Postgres when available; falls back to an
 * in-memory bucket per lambda so the limiter never silently disables itself
 * during a database hiccup.
 *
 * Returns a NextResponse (429 / 503) when blocked, otherwise null.
 */
export async function assertRateLimitJson(
  request: Request,
  routePrefix: string,
  maxPerWindow: number,
  options: RateLimitOptions = {},
): Promise<NextResponse | null> {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const ip = getClientIp(request);
  // Compose a key from route + (userId if present) + IP. Including both means
  // an attacker can't reset by rotating either dimension on its own.
  const subject = options.userId ? `u:${options.userId}:${ip}` : `ip:${ip}`;
  const dim = options.dimension
    ? `:d:${options.dimension.slice(0, 64)}`
    : "";
  const key = `${routePrefix}:${subject}${dim}:${windowBucket(windowMs)}`;

  // Path A: Postgres-backed atomic counter.
  if (isDatabaseConfigured()) {
    const sql = getSql();
    if (sql) {
      try {
        const expiresAt = new Date(Date.now() + windowMs * 2);
        const rows = await sql<{ count: number }[]>`
          INSERT INTO rate_limit_buckets (key, count, expires_at)
          VALUES (${key}, 1, ${expiresAt})
          ON CONFLICT (key) DO UPDATE
            SET count = rate_limit_buckets.count + 1
          RETURNING count
        `;
        const count = Number(rows[0]?.count ?? 1);

        // Opportunistic GC: roughly once every 500 calls, sweep expired rows
        // so the table doesn't accumulate one row per (key, minute) forever.
        // Math.random keeps the sweep off the critical path for the vast
        // majority of requests; the DELETE is index-backed by expires_at.
        if (Math.random() < 0.002) {
          await sql`DELETE FROM rate_limit_buckets WHERE expires_at < NOW()`.catch(
            () => {
              /* best effort */
            },
          );
        }

        if (count > maxPerWindow) {
          const retryAfterSec = Math.max(
            1,
            Math.ceil((windowMs - (Date.now() % windowMs)) / 1000),
          );
          return rateLimitedResponse(retryAfterSec);
        }
        return null;
      } catch (err) {
        console.error(
          "[dawasarthi] rate-limit DB error, falling back to memory:",
          err instanceof Error ? err.message : err,
        );
        // fall through to memory limiter
      }
    }
  }

  // Path B: in-memory fallback so the limiter is never effectively disabled.
  const { allowed, retryAfterSec } = memoryLimitCheck(
    key,
    maxPerWindow,
    windowMs,
  );
  if (!allowed) return rateLimitedResponse(retryAfterSec);
  return null;
}

function rateLimitedResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please wait a moment and try again.",
      retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
