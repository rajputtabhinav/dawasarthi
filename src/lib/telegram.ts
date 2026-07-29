/**
 * Server-only Telegram bot client. Used for admin-only alerts —
 *   • Real-time new-order pings (fired from /api/orders POST)
 *   • 9 PM IST daily summary (Vercel cron → /api/cron/daily-summary)
 *
 * Configuration env vars:
 *   TELEGRAM_BOT_TOKEN       — bot token from @BotFather (server secret)
 *   TELEGRAM_ADMIN_CHAT_ID   — numeric chat id (own DM or group). Leave
 *                              empty during initial deploy; the helper
 *                              silently skips sending until it's set.
 *
 * Failures (timeout, 4xx, 5xx) are logged but never thrown — losing a
 * Telegram message must never break order placement or the cron handler.
 */

const TELEGRAM_API = "https://api.telegram.org";

export function isTelegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
      process.env.TELEGRAM_ADMIN_CHAT_ID?.trim(),
  );
}

/**
 * Escape a string for safe inclusion in HTML-formatted Telegram messages.
 * Telegram's HTML parser supports <b>, <i>, <code>, <a>, <pre>; any
 * literal <, >, & in user-supplied content (customer names, addresses)
 * must be entity-encoded or the whole message fails to parse.
 */
export function escapeTelegramHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send a message to the configured admin chat. Returns true on a 2xx
 * response; false on any failure (missing config, network error, bad
 * token, blocked-by-user, etc.). Callers should treat the return as
 * informational, not as a basis for retry — the caller's primary work
 * (persisting an order, running the cron) must succeed independently.
 */
export async function sendAdminTelegramMessage(
  htmlText: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText.slice(0, 4096), // Telegram hard cap
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      // Telegram is usually <100ms but block on a hard 5s cap so a
      // serverless lambda can't be held open by network weirdness.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "[dawasarthi] telegram non-2xx:",
        res.status,
        body.slice(0, 200),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "[dawasarthi] telegram send failed:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
