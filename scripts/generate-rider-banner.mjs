/**
 * Generates 2 wide rider hero banners via OpenRouter (Nano Banana Pro /
 * Gemini 3 Pro Image). Same 21:9 main-page banner shape as
 * scripts/generate-hero-banners.mjs.
 *
 * These banners have the headline + sub-line + CTA baked INTO the image
 * (text composited by the model itself), recruitment-poster style — matching
 * the existing main-page hero banners.
 *
 * Usage:
 *   npm run generate:rider-banner
 *
 * Env:
 * - OPENROUTER_API_KEY (required, from .env.local or Vercel env)
 * - OPENROUTER_IMAGE_MAX_TOKENS — cap completion budget (default 3072)
 * - GENERATE_RIDER_BANNER_OVERWRITE=1 — regenerate even if files exist
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../public/marketing");

const MODEL = "google/gemini-3-pro-image-preview";

/** Shared creative rules — same anchor as the main-page hero generator. */
const STYLE_ANCHOR = `
Ultra-high-end PROFESSIONAL Indian e-pharmacy recruitment WEB BANNER for brand "DAWASARTHI" — wide 21:9 cinematic landscape composition for a delivery rider careers page hero carousel.

Style is editorial commercial photography combined with clean modern marketing typography (think Swiggy / Zomato / Apple recruitment hero banners), NOT AI illustration. Photoreal natural skin and natural faces on people (NOT uncanny CGI). Warm late-afternoon golden-hour light. Editorial color grading (gentle teal-and-amber), no Instagram filter.

Brand details (subtle on clothing / bags / signage):
- Riders wear a deep-teal (#184f63) fitted zip jacket with a small invented "DAWASARTHI" wordmark chest patch — refined, not loud.
- Clean teal cross-body or top-box delivery bag with a small white medical-cross icon.

Setting:
Indian tier-3 small-town street (Dibiyapur, Uttar Pradesh vibe) — low-rise pastel shopfronts, occasional greenery, clean tarmac. No clutter, no visible competitor signage.

Typography rules (FOLLOW EXACTLY):
- Headline and CTA must be rendered as REAL TYPOGRAPHY, perfectly readable, no garbled letters, no double letters, no missing characters, no spelling errors.
- Font: bold modern geometric sans serif (similar to commercial OOH ads — Helvetica Black / Inter Black weight).
- Use SHORT punchy text only (large words, short lines). NO long paragraphs in the image.
- Headline in white on the teal panel; sub-line in light teal #b8e0e6.
- CTA: a coral-red (#e85a4f) rounded-pill button with white bold text and a small white right-arrow chevron.
- A small white "DAWASARTHI" wordmark logo top-left of the text panel.

Strictly FORBIDDEN:
- Any visible real-world brand name, logo, or trademark (no Swiggy/Zomato/Blinkit/Zepto/PharmEasy/Tata 1mg/Apollo/Amazon/Flipkart/Uber/Ola/Rapido).
- Uncanny plastic-smooth 3D CGI faces.
- Ethereal AI glow blobs, surreal lighting, painterly/illustrated/cartoon style.
- Mock browser chrome, fake phone UI overlays, stock-photo watermarks.
- Garbled / mis-spelled letters anywhere in the image.

Output: single flat ultra-wide landscape commercial banner, 4K-class sharpness, magazine-ad quality, natural color grading.
`.trim();

const PROMPTS = [
  {
    file: "rider-hero-01.jpg",
    prompt: `${STYLE_ANCHOR}
Banner 1 — EARNINGS HOOK.
LAYOUT: split 45/55. LEFT panel solid deep teal (#184f63) flat color with subtle very faint geometric pill-shape texture; RIGHT photoreal lifestyle photo.
LEFT panel content (rendered as crisp real text):
  • Top: small white "DAWASARTHI" wordmark logo
  • Huge bold headline in white, on two lines:
      "EARN ₹20,000 – ₹35,000"
      "PER MONTH."
  • Sub-line in light teal #b8e0e6: "Deliver medicines in Dibiyapur"
  • Coral-red (#e85a4f) rounded-pill CTA button below sub-line with white bold text "APPLY NOW" and a small white right-arrow chevron
RIGHT photo content:
  Young Indian male rider in mid-20s, photoreal, standing confidently with a small smile beside a clean modern black scooter. Open-face helmet held in one hand. Wearing the deep-teal Dawasarthi zip jacket with the small chest patch. Cross-body teal delivery bag with white medical-cross icon. Pastel small-town shopfronts soft-blurred behind. Late-afternoon golden-hour light, gentle rim light on rider's hair.`,
  },
  {
    file: "rider-hero-02.jpg",
    prompt: `${STYLE_ANCHOR}
Banner 2 — TRUST + PAYOUTS.
LAYOUT: split 55/45. LEFT photoreal photo; RIGHT panel solid deep teal (#184f63) flat color with subtle faint capsule-shape texture.
LEFT photo content:
  Young Indian Dawasarthi rider in teal jacket handing a small kraft-paper medicine package to a smiling middle-aged Indian woman customer at her doorstep. Customer wears a printed kurta and reaches with both hands gratefully. Warm soft sunlight, scooter parked just out of focus in background. Warm, human, professional. Composition leaves the right half clean for the text panel.
RIGHT panel content (rendered as crisp real text):
  • Top: small white "DAWASARTHI" wordmark logo
  • Bold white headline on three lines, all caps:
      "FAIR PAY."
      "REAL SUPPORT."
      "EVERY ORDER."
  • Sub-line in light teal #b8e0e6: "Weekly UPI payouts · Fuel allowance"
  • Coral-red (#e85a4f) rounded-pill CTA button with white bold text "APPLY NOW" and a small white right-arrow chevron`,
  },
];

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
    Number.parseInt(process.env.OPENROUTER_IMAGE_MAX_TOKENS ?? "3072", 10) ||
      3072,
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
        "X-Title": "Dawasarthi Rider Banner",
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
            `OpenRouter 402 — session max_tokens cap → ${sessionTokenCeiling} (reported afford ~${afford})`,
          );
          continue;
        }
      }
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
    }

    if (!res.ok) {
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 500)}`);
    }

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
  // 21:9 first to match main hero shape, 16:9 fallback.
  const attempts = [
    { aspect_ratio: "21:9", image_size: "2K" },
    { aspect_ratio: "16:9", image_size: "2K" },
    { aspect_ratio: "21:9", image_size: "4K" },
    { aspect_ratio: "16:9", image_size: "4K" },
    { aspect_ratio: "16:9" },
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

async function compressForWeb(rawBuf) {
  return sharp(rawBuf)
    .resize({
      width: 1920,
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({ quality: 84, mozjpeg: true, progressive: true })
    .toBuffer();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const overwrite = process.env.GENERATE_RIDER_BANNER_OVERWRITE === "1";

  // Clean up the legacy single-file path if present.
  const legacy = path.join(OUT_DIR, "rider-hero.jpg");
  if (fs.existsSync(legacy)) {
    fs.unlinkSync(legacy);
    console.log("  Removed legacy rider-hero.jpg.");
  }

  let i = 0;
  for (const { file, prompt } of PROMPTS) {
    i += 1;
    const outPath = path.join(OUT_DIR, file);
    if (!overwrite && fs.existsSync(outPath) && fs.statSync(outPath).size > 1024) {
      const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
      console.log(
        `[${i}/${PROMPTS.length}] Skip ${file} (exists, ${sizeMb} MB). Set GENERATE_RIDER_BANNER_OVERWRITE=1 to regenerate.`,
      );
      continue;
    }

    console.log(`[${i}/${PROMPTS.length}] Generating ${file} via ${MODEL} …`);
    const rawBuf = await generateWithFallback(prompt);
    console.log(
      `  Received ${(rawBuf.length / 1024 / 1024).toFixed(2)} MB — compressing…`,
    );
    const optimised = await compressForWeb(rawBuf);
    fs.writeFileSync(outPath, optimised);
    console.log(
      `  Wrote ${outPath} (${(optimised.length / 1024 / 1024).toFixed(2)} MB optimised)`,
    );

    if (i < PROMPTS.length) await delay(3000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
