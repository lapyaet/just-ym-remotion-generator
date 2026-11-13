import "server-only";

/**
 * Long .md briefs (scripts, campaign docs) are condensed to their key lines
 * before they reach the AI, so they fit the model's request limit. Groq's free
 * tier allows only ~8,000 tokens per minute, and Burmese text uses far more
 * tokens per character than English.
 *
 * Extractive only (no AI call): the brief is cleaned, then whole lines are kept
 * in their original order, preferring headings, timestamps / scene markers,
 * on-screen text, prices, discounts and bullet points.
 */

export const MAX_UPLOAD_CHARS = 200_000;

/** Estimated tokens: ~4 chars/token for Latin text, ~1 token per Myanmar character (conservative). */
export function estimateTokens(text: string) {
  const myanmar = (text.match(/[က-႟ꧠ-꧿ꩠ-ꩿ]/g) ?? []).length;
  return Math.ceil(myanmar * 1.0 + (text.length - myanmar) / 4);
}

/**
 * Token budget for the brief, by AI provider. Override with BRIEF_MAX_TOKENS,
 * e.g. after upgrading the Groq plan or when using a local model with a big context.
 */
export function briefTokenBudget(provider: "open-model" | "claude" | "demo") {
  const override = Number(process.env.BRIEF_MAX_TOKENS);
  if (Number.isFinite(override) && override > 0) return override;
  if (provider === "claude") return 60_000;
  if (provider === "demo") return 20_000;
  return 3_000; // Groq free tier: leaves room for instructions, the product list and the answer
}

export type CondensedBrief = { text: string; condensed: boolean; originalChars: number; keptChars: number };

export function condenseBrief(raw: string, maxTokens: number): CondensedBrief {
  const cleaned = clean(raw);
  const originalChars = raw.length;
  if (estimateTokens(cleaned) <= maxTokens) {
    return { text: cleaned, condensed: cleaned.length < raw.length * 0.9, originalChars, keptChars: cleaned.length };
  }

  const lines = cleaned.split("\n").map((text, index) => ({ text: shorten(text), index }));
  const firstContent = lines.filter((l) => l.text.trim()).slice(0, 4).map((l) => l.index);
  const scored = lines
    .filter((l) => l.text.trim())
    .map((l) => ({ ...l, score: score(l.text) + (firstContent.includes(l.index) ? 10 : 0) - l.index * 0.0001 }));

  // Take the highest-scoring lines that fit, then restore the original order.
  const picked = new Set<number>();
  let used = 0;
  for (const l of [...scored].sort((a, b) => b.score - a.score)) {
    const cost = estimateTokens(l.text) + 1;
    if (used + cost > maxTokens) continue;
    picked.add(l.index);
    used += cost;
  }
  // "…" marks only gaps where real text was skipped (not just blank lines).
  const out: string[] = [];
  let skippedText = false;
  for (const l of lines) {
    if (picked.has(l.index)) {
      if (skippedText && out.length) out.push("…");
      out.push(l.text);
      skippedText = false;
    } else if (l.text.trim()) {
      skippedText = true;
    }
  }
  const text = out.join("\n");
  return { text, condensed: true, originalChars, keptChars: text.length };
}

/** Remove Markdown noise that costs tokens but carries no meaning. */
function clean(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)]\((?:[^)]*)\)/g, "$1") // links -> text
    .replace(/<\/?[a-z][^>]*>/gi, "") // html tags
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, "") // table separator rows
    .replace(/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/gm, "") // horizontal rules
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Very long paragraphs keep their first ~2 sentences. */
function shorten(line: string) {
  if (line.length <= 320) return line;
  const sentences = line.split(/(?<=[.!?။])\s+/);
  const kept = sentences.slice(0, 2).join(" ");
  return (kept.length > 320 ? kept.slice(0, 300) : kept) + " …";
}

function score(line: string) {
  const l = line.trim();
  let s = 1;
  if (/^#{1,6}\s/.test(l)) s += 6; // heading
  if (/\b\d{1,2}:\d{2}\b/.test(l)) s += 5; // timestamp
  if (/\b(scene|shot|part|hook|cta|outro|intro|overlay|caption|text|vo|voice ?over|title)\b/i.test(l)) s += 4;
  if (/["“”'‘’「」]/.test(l)) s += 2; // quoted on-screen text
  if (/^\s*([-*+•]|\d+[.)])\s/.test(l)) s += 2; // bullet / numbered
  if (/%|฿|\$|S\$|RM|THB|SGD|MMK|\bks\b|price|discount|off\b|sale|deal/i.test(l)) s += 3;
  if (/\d/.test(l)) s += 1;
  if (/^(purpose|goal|audience|target|tone|style|format|duration|length|platform|cta|call to action)\b/i.test(l)) s += 5;
  if (l.length < 6) s -= 1;
  return s;
}
