/**
 * Generates 6 wide hero banners via OpenRouter (Nano Banana Pro / Gemini 3 Pro Image).
 * Style: professional Indian e-pharmacy D2C ads (clean layout, studio lighting), not generic AI illustration.
 *
 * Usage: npm run generate:banners
 * Requires OPENROUTER_API_KEY in .env.local
 *
 * Env:
 * - OPENROUTER_IMAGE_MAX_TOKENS — cap completion budget (default 3072; image API may 402 if balance only covers ~3k).
 * - GENERATE_BANNERS_OVERWRITE=1 — regenerate even if output file already exists.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../public/marketing");

const MODEL = "google/gemini-3-pro-image-preview";

/** Shared creative rules — pushes output toward premium retail banners, away from generic “AI hero” clichés */
const STYLE_ANCHOR = `
CRITICAL STYLE (must follow):
Ultra-high-end PROFESSIONAL Indian e-pharmacy WEB BANNER for brand "DAWASARTHI" ONLY (invented wordmark/logo — NEVER show PharmEasy, Apollo, Flipkart Health, Tata 1mg, Amazon Pharmacy, EVERHERB, or any competitor name or trademark).
Must look like a real performance marketing banner from Behance/Pinterest pharma retail creatives: razor-sharp vector + studio product photography HYBRID, generous whitespace, perfect alignment grid, restrained shadows only.
Absolutely FORBIDDEN: ethereal AI glow blobs, exaggerated lens flare, over-smooth plastic CGI people, surreal lighting, painterly textures, stock "futuristic medicine" clichés, fake stock photo watermarks, triple-row microcopy clutter.
Typography: bold modern geometric sans (like commercial OTT ads), high contrast, large readable headline, one short subline max, one CTA button (contrasting color e.g. coral red or deep green) with text "ORDER NOW" or "SHOP NOW".
Color world: deep teal #184f63, crisp white, subtle navy; accent only for CTA and offer pill.
Output: single flat landscape composition, 4K-class sharpness, print-ready edges, no mock browser chrome, no fake phone UI.
`.trim();

const PROMPTS = [
  {
    file: "hero-01.jpg",
    prompt: `${STYLE_ANCHOR}
Layout like a major pharmacy app hero: LEFT — happy young Indian woman in soft sage sweater, natural studio photo, pointing finger toward center offer; CENTER — huge headline "Best brands. Bigger savings." with subline "Dibiyapur · 30-minute delivery · COD"; RIGHT — cluster of photoreal OTC products (blister strips, vitamin bottle, ortho support sleeve) with soft shadows; bottom-right red pill CTA "ORDER NOW" with chevron.
Background: solid medium-teal with subtle lighter wave shapes (very subtle, not busy).`,
  },
  {
    file: "hero-02.jpg",
    prompt: `${STYLE_ANCHOR}
Split hero (60/40): LEFT light textured off-white panel with tasteful lifestyle photo of fit Indian man thumbs-up with towel (gym/wellness vibe, natural skin); CENTER-LEFT product hero — photoreal supplement/vitamin bottle with clean "DAWASARTHI" style label (generic look, no real brand); RIGHT bold magenta-rose panel with botanical line art barely visible; green ribbon price strip "FROM ₹99" style; white trust chip "Genuine stock"; large dark red CTA "ORDER NOW".
Curved dividing line between panels like premium FMCG D2C ads.`,
  },
  {
    file: "hero-03.jpg",
    prompt: `${STYLE_ANCHOR}
Fresh teal-green field (#2a9d8f direction) inspired by vaccination-public-health campaign clarity but topic = medicine delivery heroes.
LEFT: rounded white tile with invented "DAWASARTHI" crest + small shopping basket illustration with medicines (clean FLAT VECTOR style, crisp not childish).
CENTER: headline in two colors "FAST DELIVERY" + "YOU CAN TRUST" and subline "Upload Rx · COD · Dawasarthi.com".
RIGHT: stylish flat-vector delivery rider in teal uniform handing medicine bag to customer at doorstep (simple friendly faces, NOT uncanny 3D).
Offer strip: dark green pill "FLAT DELIVERY BENEFITS" small yellow highlight text.
Decor: a few abstract pill-shaped geometry accents in yellow and darker teal — minimal.`,
  },
  {
    file: "hero-04.jpg",
    prompt: `${STYLE_ANCHOR}
Trust & clinical credibility theme. Deep navy-to-teal gradient BACKGROUND very subtle.
LEFT: professional Indian pharmacist figure in crisp white coat (neutral face, approachable) beside large transparent shield icon with green checkmark.
CENTER: headline "Verified medicines · Every order checked" secondary "Cold-chain aware · Authentic sourcing".
RIGHT: macro studio photo of foil strips and thermometer motif suggesting quality (no unreadable microscopic text).
CTA pill bottom right emerald "SHOP MEDICINES".`,
  },
  {
    file: "hero-05.jpg",
    prompt: `${STYLE_ANCHOR}
Night-shift / 247 support motif. Moody but CLEAN: deep teal night city silhouette ultra subtle, foreground bright studio scene.
Hands-only composition: customer phone showing generic map pin + warm desk lamp; packaging tape on Dawasarthi-branded box (invented simple wordmark).
Headline "Order till late · We are here" subline "Call support anytime".
CTA "ORDER NOW" warm coral button. No horror hospital imagery.`,
  },
  {
    file: "hero-06.jpg",
    prompt: `${STYLE_ANCHOR}
Family wellness Saturday-morning vibe: soft daylight kitchen table, Indian family (two adults + child) background slightly blurred, foreground sharp arrangement of everyday health products (ORS, thermometer, bandages, multivitamin) as still-life.
Headline "Everything your family needs" subline "Dibiyapur · Dawasarthi".
Right side white card with green CTA "SHOP NOW".
Photoreal, editorial magazine ad quality, natural color grading not oversaturated.`,
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

/** Avoid resetting max_tokens to env default on every image_config retry (same Node process). */
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
        "X-Title": "Dawasarthi Hero Generation",
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
  /** Try 2K before 4K — often enough detail for web heroes and lighter on credits. */
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

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function firstExistingHeroPath() {
  const preferred = [
    "hero-02.jpg",
    "hero-01.jpg",
    "hero-03.jpg",
    "hero-04.jpg",
    "hero-05.jpg",
    "hero-06.jpg",
  ];
  for (const f of preferred) {
    const p = path.join(OUT_DIR, f);
    if (fs.existsSync(p) && fs.statSync(p).size > 1024) return p;
  }
  return null;
}

/** If the API stops mid-batch (e.g. out of credits), copy from a known-good slide so Next never 404s. */
function ensureHeroSetComplete() {
  const src = firstExistingHeroPath();
  if (!src) {
    console.warn("\nNo hero PNGs found — cannot patch missing slides.");
    return false;
  }
  let patched = false;
  for (const { file } of PROMPTS) {
    const dest = path.join(OUT_DIR, file);
    if (!fs.existsSync(dest) || fs.statSync(dest).size <= 1024) {
      fs.copyFileSync(src, dest);
      console.warn(
        `  Patched ${file} ← ${path.basename(src)} — add OpenRouter credits and re-run (no OVERWRITE needed for missing only).`,
      );
      patched = true;
    }
  }
  return !patched;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const overwrite = process.env.GENERATE_BANNERS_OVERWRITE === "1";

  let apiError = false;
  let i = 0;
  for (const { file, prompt } of PROMPTS) {
    i += 1;
    const outPath = path.join(OUT_DIR, file);
    if (!overwrite && fs.existsSync(outPath)) {
      const st = fs.statSync(outPath);
      if (st.size > 1024) {
        console.log(
          `[${i}/6] Skip ${file} (exists, ${(st.size / 1024 / 1024).toFixed(2)} MB). Set GENERATE_BANNERS_OVERWRITE=1 to replace.`,
        );
        continue;
      }
    }
    console.log(`[${i}/6] Generating ${file} …`);
    try {
      const buf = await generateWithFallback(prompt);
      // Nano Banana returns PNG bytes regardless of requested output format.
      // Re-encode to mozjpeg quality 82 progressive — the JPGs are ~10× smaller
      // than the PNG originals with no visible quality difference at banner size.
      const jpg = await sharp(buf)
        .jpeg({ quality: 82, mozjpeg: true, progressive: true })
        .toBuffer();
      fs.writeFileSync(outPath, jpg);
      console.log(
        "  Wrote",
        outPath,
        `(${(jpg.length / 1024 / 1024).toFixed(2)} MB, from ${(buf.length / 1024 / 1024).toFixed(2)} MB PNG)`,
      );
      await delay(4000);
    } catch (e) {
      apiError = true;
      console.error(`  Failed ${file}:`, e.message);
    }
  }

  const complete = ensureHeroSetComplete();
  const allPresent = PROMPTS.every(({ file }) => {
    const p = path.join(OUT_DIR, file);
    return fs.existsSync(p) && fs.statSync(p).size > 1024;
  });

  console.log(
    "\nRemoving legacy hero filenames if present (hero-delivery.jpg, hero-trust.jpg).",
  );
  for (const legacy of ["hero-delivery.jpg", "hero-trust.jpg"]) {
    const p = path.join(OUT_DIR, legacy);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log("  Deleted", legacy);
    }
  }

  if (!allPresent) {
    console.error("\nAbort: not all hero-01…hero-06 files could be created.");
    process.exit(1);
  }
  if (apiError || !complete) {
    console.warn(
      "\nDone with warnings: one or more slides were skipped or patched. Top up OpenRouter and re-run `npm run generate:banners` to fill unique art.",
    );
  } else {
    console.log(
      "\nDone — HeroAiBanners expects hero-01.jpg … hero-06.jpg in public/marketing/.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
