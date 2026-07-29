/**
 * Generates square "Shop by health concerns" tiles (2K-class) via OpenRouter
 * (google/gemini-3-pro-image-preview).
 *
 * Usage: npm run generate:health-icons
 * Env: OPENROUTER_API_KEY in .env.local
 * Optional: OPENROUTER_IMAGE_MAX_TOKENS, GENERATE_HEALTH_ICONS_OVERWRITE=1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../public/marketing/health-concerns");
const MODEL = "google/gemini-3-pro-image-preview";

const STYLE_ANCHOR = `
OUTPUT: ONE square 1:1 image, 2K-class sharpness, clean e‑pharmacy category tile for "DAWASARTHI" (no competitor logos or names).

MOOD: Premium Indian health app category icon — photographic but CALM and TRUSTWORTHY, looks like a polished marketing asset (not generic AI collage).

VISUAL RULES:
- Soft solid or gentle gradient pastel studio background (single hue family, generous empty space).
- One clear subject only; waist-up or close-up; natural skin; NO horror, NO gore, NO blood.
- ONE subtle educational highlight: soft warm/red GLOW or thin line-art overlay on the relevant body area (heart, abdomen, joints, etc.) — tasteful like major pharmacy apps.
- Modern commercial lighting, sharp focus, shallow depth — NOT painterly, NOT lens-flare soup, NOT plastic CGI faces.
- NO text, NO watermarks, NO UI chrome, NO medicine brand packs with readable trademarks.
`.trim();

const TILES = [
  {
    file: "diabetes.png",
    prompt: `${STYLE_ANCHOR}
THEME: Diabetes care. Indian adult hands holding a simple generic glucometer (no brand legible) showing a neutral reading. Soft peach-to-apricot background.`,
  },
  {
    file: "heart-care.png",
    prompt: `${STYLE_ANCHOR}
THEME: Heart care. Indian woman in casual top, hand near chest; subtle glowing heart silhouette / soft red light over chest (non-scary). Soft lavender-mauve background.`,
  },
  {
    file: "stomach-care.png",
    prompt: `${STYLE_ANCHOR}
THEME: Stomach / digestion care. Person holding upper abdomen gently; faint warm glow over stomach area. Fresh mint-sage green background.`,
  },
  {
    file: "liver-care.png",
    prompt: `${STYLE_ANCHOR}
THEME: Liver care. Man in plain white tee, subtle semi-transparent line-art liver outline + soft glow over right upper abdomen. Soft coral-rose background.`,
  },
  {
    file: "bone-joint-muscle.png",
    prompt: `${STYLE_ANCHOR}
THEME: Bone, joint & muscle. Close-up knee and hands; delicate red-orange highlight on kneecap / joint (orthopedic education style). Soft blush-pink background.`,
  },
  {
    file: "kidney-care.png",
    prompt: `${STYLE_ANCHOR}
THEME: Kidney / urinary wellness. Woman in simple top, hand on lower back/flank; soft glow at kidney region. Calm teal-aqua background.`,
  },
  {
    file: "derma-care.png",
    prompt: `${STYLE_ANCHOR}
THEME: Skin / derma care. Smiling Indian woman with a few neat cream dots on cheeks (cosmetic care vibe). Soft petal-pink background.`,
  },
  {
    file: "respiratory-care.png",
    prompt: `${STYLE_ANCHOR}
THEME: Respiratory care. Woman using a generic plastic inhaler (no brand text), calm expression. Warm pale peach background.`,
  },
  {
    file: "fever-flu.png",
    prompt: `${STYLE_ANCHOR}
THEME: Fever & flu care. Person resting with clean soft cloth on forehead; simple oral thermometer nearby (no brand); tired but calm. Soft cool blue-lilac background.`,
  },
  {
    file: "vitamins-immunity.png",
    prompt: `${STYLE_ANCHOR}
THEME: Vitamins & immunity. Bright healthy Indian adult giving thumbs-up; small generic fruit + abstract soft sun-ray shapes (no supplement bottles with text). Lemon-fresh yellow-lime gradient background.`,
  },
  {
    file: "thyroid-care.png",
    prompt: `${STYLE_ANCHOR}
THEME: Thyroid wellness. Person gently touching front of neck; subtle soft glow at throat (thyroid area, tasteful). Dusty soft blue-gray background.`,
  },
  {
    file: "infection-care.png",
    prompt: `${STYLE_ANCHOR}
THEME: Infection / antibiotics theme (non-graphic). Clinical calm: healthcare worker hands in generic blue gloves holding a single plain white round tablet (no imprint text). Very soft mint clinical background.`,
  },
  {
    file: "daily-wellness.png",
    prompt: `${STYLE_ANCHOR}
THEME: Daily wellness. Relaxed Indian person stretching arms in morning light; water bottle silhouette blurred in background (no logos). Soft dawn peach-to-cream gradient.`,
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
        "X-Title": "Dawasarthi Health Icons",
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
    { aspect_ratio: "3:4", image_size: "2K" },
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

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function firstExistingIconPath() {
  for (const { file } of TILES) {
    const p = path.join(OUT_DIR, file);
    if (fs.existsSync(p) && fs.statSync(p).size > 1024) return p;
  }
  return null;
}

function ensureIconSetComplete() {
  const src = firstExistingIconPath();
  if (!src) {
    console.warn("\nNo health concern PNGs found — cannot patch missing files.");
    return false;
  }
  let patched = false;
  for (const { file } of TILES) {
    const dest = path.join(OUT_DIR, file);
    if (!fs.existsSync(dest) || fs.statSync(dest).size <= 1024) {
      fs.copyFileSync(src, dest);
      console.warn(
        `  Patched ${file} ← ${path.basename(src)} — re-run when credits available for unique art.`,
      );
      patched = true;
    }
  }
  return !patched;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const overwrite = process.env.GENERATE_HEALTH_ICONS_OVERWRITE === "1";

  let apiError = false;
  let i = 0;
  const n = TILES.length;

  for (const { file, prompt } of TILES) {
    i += 1;
    const outPath = path.join(OUT_DIR, file);
    if (!overwrite && fs.existsSync(outPath)) {
      const st = fs.statSync(outPath);
      if (st.size > 1024) {
        console.log(
          `[${i}/${n}] Skip ${file} (exists). Set GENERATE_HEALTH_ICONS_OVERWRITE=1 to replace.`,
        );
        continue;
      }
    }
    console.log(`[${i}/${n}] Generating ${file} …`);
    try {
      const buf = await generateWithFallback(prompt);
      fs.writeFileSync(outPath, buf);
      console.log(
        "  Wrote",
        outPath,
        `(${(buf.length / 1024 / 1024).toFixed(2)} MB)`,
      );
      await delay(3500);
    } catch (e) {
      apiError = true;
      console.error(`  Failed ${file}:`, e.message);
    }
  }

  const complete = ensureIconSetComplete();
  const allPresent = TILES.every(({ file }) => {
    const p = path.join(OUT_DIR, file);
    return fs.existsSync(p) && fs.statSync(p).size > 1024;
  });

  if (!allPresent) {
    console.error("\nAbort: not all health concern PNGs exist.");
    process.exit(1);
  }
  if (apiError || !complete) {
    console.warn(
      "\nDone with warnings: some tiles were patched or failed. Re-run `npm run generate:health-icons` after topping up credits.",
    );
  } else {
    console.log(
      "\nDone — tiles in public/marketing/health-concerns/ (see ShopByHealthConcerns).",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
