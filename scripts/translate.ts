import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import translate from "google-translate-api-x";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const LOCALES_DIR = resolve(ROOT, "public/locales");

// Google Translate language codes → output folder names
const TARGETS: Array<{ gtCode: string; folder: string; label: string }> = [
  { gtCode: "tl", folder: "fil", label: "Filipino" },
  { gtCode: "ilo", folder: "ilo", label: "Ilocano" },
];

const DELAY_MS = 120; // pause between API calls to avoid throttling

type TranslationObject = Record<string, Record<string, string>>;

// ── Helpers ──────────────────────────────────────────────

/** Pause for `ms` milliseconds. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Returns true if the value has no translatable text —
 * e.g. "LUaid.org", pure interpolation like "{{count}}", or empty strings.
 */
function isUntranslatable(value: string): boolean {
  // Strip all {{…}} interpolation tokens
  const stripped = value.replace(/\{\{.*?\}\}/g, "").trim();
  // Nothing left, or only a URL/brand name with no spaces
  if (stripped === "") return true;
  // Pure URL or domain-like string
  if (/^https?:\/\/\S+$/.test(stripped)) return true;
  if (/^\S+\.\S+$/.test(stripped) && !stripped.includes(" ")) return true;
  return false;
}

/**
 * Strips {{interpolation}} placeholders before translation and restores them after.
 * Google Translate often mangles curly braces, so we swap them with numbered tokens.
 */
function translateWithPlaceholders(
  value: string,
  gtCode: string
): Promise<string> {
  const placeholders: string[] = [];
  const withTokens = value.replace(/\{\{.*?\}\}/g, (match) => {
    placeholders.push(match);
    return `__PH${placeholders.length - 1}__`;
  });

  return translate(withTokens, { from: "en", to: gtCode }).then((res) => {
    let translated: string = res.text;
    // Restore placeholders
    placeholders.forEach((ph, i) => {
      // Google sometimes adds spaces around our tokens
      const pattern = new RegExp(`__PH${i}__`, "gi");
      translated = translated.replace(pattern, ph);
    });
    return translated;
  });
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const enPath = resolve(LOCALES_DIR, "en/translation.json");
  const source: TranslationObject = JSON.parse(
    readFileSync(enPath, "utf-8")
  );

  // Count total keys
  const totalKeys = Object.values(source).reduce(
    (sum, ns) => sum + Object.keys(ns).length,
    0
  );
  console.log(`→ Reading ${enPath} (${totalKeys} keys)\n`);

  for (const { gtCode, folder, label } of TARGETS) {
    console.log(`→ Translating to ${label} (${gtCode} → ${folder}/)...`);

    // Load existing translations to preserve human-reviewed work
    const outPath = resolve(LOCALES_DIR, `${folder}/translation.json`);
    const existing: TranslationObject = existsSync(outPath)
      ? JSON.parse(readFileSync(outPath, "utf-8"))
      : {};

    const output: TranslationObject = {};
    let translated_count = 0;
    let kept_count = 0;

    for (const [namespace, entries] of Object.entries(source)) {
      output[namespace] = {};

      for (const [key, value] of Object.entries(entries)) {
        const existingValue = existing[namespace]?.[key];

        // If the target file already has a value that differs from
        // the English source, a human or previous run translated it — keep it
        if (existingValue && existingValue !== value) {
          output[namespace][key] = existingValue;
          console.log(`  · ${namespace}.${key} — kept existing`);
          kept_count++;
          continue;
        }

        if (isUntranslatable(value)) {
          output[namespace][key] = value;
          console.log(`  - ${namespace}.${key} — ${value} (untranslatable)`);
          continue;
        }

        try {
          const result = await translateWithPlaceholders(value, gtCode);
          output[namespace][key] = result;
          console.log(`  ✓ ${namespace}.${key} — ${result}`);
          translated_count++;
        } catch (err) {
          // On error, keep the English string and warn
          output[namespace][key] = value;
          console.error(`  ✗ ${namespace}.${key} — FAILED, kept English`);
          console.error(`    ${err}`);
        }

        await sleep(DELAY_MS);
      }
    }

    writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
    console.log(`\n  → Wrote ${outPath} (${translated_count} new, ${kept_count} kept)\n`);
  }

  console.log("→ Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
