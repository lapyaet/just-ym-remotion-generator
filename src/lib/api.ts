import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "./session";
import { condenseBrief, MAX_UPLOAD_CHARS } from "./brief";

/** For API routes: the signed-in user, or a 401 response. */
export async function apiUser() {
  const session = await getSession();
  if (!session) {
    return { user: null, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;
  }
  return { user: session.user, response: null } as const;
}


/**
 * A video request: the typed prompt and/or an attached Markdown brief.
 * Returns the full text for the AI plus a short summary to store/display.
 */
export function readVideoRequest(body: unknown, hasReference = false, briefTokens = 3_000): { text: string; summary: string } | { error: string } {
  const b = (body ?? {}) as { prompt?: unknown; brief?: unknown; briefName?: unknown };
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  const brief = typeof b.brief === "string" ? b.brief.replace(/\r\n/g, "\n").trim() : "";
  const name = typeof b.briefName === "string" ? b.briefName.replace(/[^\w .()-]/g, "").slice(0, 80) || "brief.md" : "brief.md";

  if (prompt.length > 2000) return { error: "The prompt can be at most 2000 characters." };
  if (brief.length > MAX_UPLOAD_CHARS) return { error: `The attached file is too long (max ${MAX_UPLOAD_CHARS.toLocaleString()} characters).` };
  if (!brief && prompt.length < 3 && !hasReference) {
    return { error: "Write a prompt (at least 3 characters), attach a .md brief, or paste a reference reel link." };
  }

  if (!brief && prompt.length < 3) {
    return { text: "Create a Just YM reel inspired by the reference reel below.", summary: "Inspired by a reference reel" };
  }
  if (!brief) return { text: prompt, summary: prompt };
  // Long briefs are condensed to their key lines so they fit the AI's request limit.
  const c = condenseBrief(brief, briefTokens);
  const label = c.condensed
    ? `Attached brief (${name}, condensed to its key lines: ${c.keptChars.toLocaleString()} of ${c.originalChars.toLocaleString()} characters; "…" marks skipped parts)`
    : `Attached brief (${name})`;
  const text = `${prompt ? `${prompt}\n\n` : ""}${label}:\n---\n${c.text}\n---`;
  const fileLabel = c.condensed ? `${name}, condensed ${Math.round((c.keptChars / c.originalChars) * 100)}%` : name;
  const summary = prompt ? `${prompt} (+ ${fileLabel})` : `Brief: ${fileLabel}`;
  return { text, summary: summary.slice(0, 2000) };
}

export const notFound =() => NextResponse.json({ error: "Not found" }, { status: 404 });
