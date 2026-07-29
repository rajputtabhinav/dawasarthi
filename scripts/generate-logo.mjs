/**
 * Generates a square brand mark via OpenRouter (Gemini image).
 *
 * Usage: npm run generate:logo
 * Env: OPENROUTER_API_KEY in .env.local
 * Optional: GENERATE_LOGO_OVERWRITE=1 (replace existing), OPENROUTER_IMAGE_MAX_TOKENS
 *
 * Writes: public/marketing/logo.png — used by BrandLogo / site-header.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "../public/marketing/logo.png");
const MODEL = "google/gemini-3-pro-image-preview";

const PROMPT = `
Professional APP LOGO IMAGE for fictional Indian medicine delivery brand "Dawasarthi" ONLY (single invented word).

OUTPUT REQUIREMENTS — CRITICAL:
- Square 1:1 composition centered in frame.
- Clean FLAT VECTOR or minimal graphic mark + stacked wordmark "Dawasarthi" in modern geometric sans (legible).
- Palette: dominant deep teal approximately #184f63, crisp white or very light aqua accents. NO gradients that look muddy.
- Subtle pharma cue: ONE of — small mortar-pestle silhouette, minimalist pill shape, OR soft medical cross fused into lettering — integrated tastefully, NOT cheesy stock clipart.
- High contrast so it reads at small favicon/header sizes.
- Generous whitespace; no busy collage; no photoreal humans.
- Transparent or solid white BACKGROUND ONLY (prefer flat white matte so it stacks on colored headers cleanly).
- FORBIDDEN: competitor names/logos (PharmEasy, Apollo, 1mg, etc.), watermark, QR code, microscopic disclaimer text.

Style: polished D2C health startup — Stripe/Flipkart-health-adjacent restraint, Behance-worthy identity mark.
`.trim();

function dataUrlToBuffer(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
  if (!m) throw new Error("Unexpected image data URL format");
  return Buffer.from(m[2], "base64");
}

function parseAffordable402(text) {
  const m = /can only afford (\d+)/i.exec(text);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

let sessionTokenCeiling = Math.min(
  32768,
  Math.max(
    1024,
    Number.parseInt(process.env.OPENROUTER_IMAGE_MAX_TOKENS ?? "3072", 10) || 3072,
  ),
);

async function callOpenRouter(prompt, imageConfig) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

  let max_tokens = sessionTokenCeiling;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const body = {
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
      max_tokens,
      ...(imageConfig && Object.keys(imageConfig).length > 0
        ? { image_config: imageConfig }
        : {}),
    };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dawasarthi.com",
        "X-Title": "Dawasarthi Logo",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (res.status === 402) {
      const afford = parseAffordable402(text);
      if (afford != null && afford > 512) {
        const proposed = Math.max(
          512,
          Math.min(sessionTokenCeiling - 1, afford - 64),
        );
        if (proposed < sessionTokenCeiling) {
          sessionTokenCeiling = proposed;
          max_tokens = sessionTokenCeiling;
          console.warn(
            `OpenRouter 402 — session max_tokens cap → ${sessionTokenCeiling}`,
          );
          continue;
        }
      }
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
    }

    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid JSON from OpenRouter");
    }

    const images = data.choices?.[0]?.message?.images;
    if (!images?.length) {
      console.error(JSON.stringify(data, null, 2).slice(0, 2000));
      throw new Error("No images in response");
    }

    const url = images[0].image_url?.url;
    if (!url?.startsWith("data:")) throw new Error("Missing base64 image URL");
    return dataUrlToBuffer(url);
  }

  throw new Error("OpenRouter: exhausted max_tokens retries");
}

async function generateWithFallback(prompt) {
  const attempts = [
    { aspect_ratio: "1:1", image_size: "2K" },
    { aspect_ratio: "1:1", image_size: "4K" },
    { aspect_ratio: "4:5", image_size: "2K" },
    { aspect_ratio: "1:1" },
    {},
  ];
  let lastErr;
  for (const cfg of attempts) {
    try {
      return await callOpenRouter(
        prompt,
        Object.keys(cfg).length ? cfg : undefined,
      );
    } catch (e) {
      lastErr = e;
      console.warn("Retry with different image_config:", e.message);
    }
  }
  throw lastErr;
}

async function main() {
  const outDir = path.dirname(OUT_PATH);
  fs.mkdirSync(outDir, { recursive: true });

  const overwrite = process.env.GENERATE_LOGO_OVERWRITE === "1";
  if (
    fs.existsSync(OUT_PATH) &&
    fs.statSync(OUT_PATH).size > 1024 &&
    !overwrite
  ) {
    console.log(
      "Skip logo (exists):",
      OUT_PATH,
      "— Set GENERATE_LOGO_OVERWRITE=1 to regenerate.",
    );
    return;
  }

  console.log("Generating logo via OpenRouter …");
  const buf = await generateWithFallback(PROMPT);
  fs.writeFileSync(OUT_PATH, buf);
  console.log(
    "Wrote",
    OUT_PATH,
    `(${(buf.length / 1024).toFixed(1)} KB)`,
    "\nUse BrandLogo site-header/footer or add /marketing/logo.png to metadata icons.",
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
