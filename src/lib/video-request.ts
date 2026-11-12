import "server-only";
import { readVideoRequest } from "./api";
import { analyzeReferenceReel, describeReference, ReferenceLinkError, summarizeReference } from "./reference-reel";

/**
 * Everything the user sent for one generation, combined into the text the AI
 * reads: typed prompt + attached .md brief + what we could read from a
 * reference reel link.
 */
export async function buildVideoRequest(body: unknown): Promise<{ text: string; summary: string } | { error: string }> {
  const raw = (body as { referenceUrl?: unknown } | null)?.referenceUrl;
  const referenceUrl = typeof raw === "string" ? raw.trim().slice(0, 2000) : "";

  const req = readVideoRequest(body, Boolean(referenceUrl));
  if ("error" in req || !referenceUrl) return req;

  try {
    const ref = await analyzeReferenceReel(referenceUrl);
    return {
      text: `${req.text}\n\n${describeReference(ref)}`,
      summary: `${req.summary} (${summarizeReference(ref)})`.slice(0, 2000),
    };
  } catch (err) {
    if (err instanceof ReferenceLinkError) return { error: err.message };
    throw err;
  }
}
