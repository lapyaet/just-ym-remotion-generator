import fs from "node:fs";
import path from "node:path";
import type { GeneratedVideo } from "@/remotion/schema";
import { describeChoices, type Choice } from "./resolve";

export class GenerationError extends Error {}

const PROMPT_FILE = path.join(process.cwd(), "prompts", "system.md");
let cached: string | undefined;

/**
 * The AI's instructions, from prompts/system.md (HTML comments removed).
 * Re-read on every call in development so edits apply without a restart.
 */
export function getSystemPrompt(): string {
  if (cached && process.env.NODE_ENV === "production") return cached;
  let text: string;
  try {
    text = fs.readFileSync(PROMPT_FILE, "utf8");
  } catch {
    throw new GenerationError("The AI instructions file prompts/system.md is missing.");
  }
  cached = text.replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!cached) throw new GenerationError("The AI instructions file prompts/system.md is empty.");
  return cached;
}

export function buildUserContent(prompt: string, previous: GeneratedVideo | undefined, choices: Choice[]) {
  const list = choices.length
    ? `Products and photos from justym.me (id | kind | name | city | price):\n${describeChoices(choices)}`
    : "No products or photos are available right now: leave every photoId empty and every productIds array empty.";

  const task = previous
    ? `Here is the current video:\n\n${JSON.stringify(previous)}\n\nRevise it according to this request and return the full updated video:\n\n${prompt}`
    : `Create a promo reel for this request:\n\n${prompt}`;

  return `${list}\n\n${task}`;
}
