import "server-only";
import { prisma } from "./prisma";
import { fromLegacySpec, normalizeSpec, VideoSpecSchema, type VideoSpec } from "@/remotion/schema";

/** Returns the project only if it belongs to the user. */
export async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, userId } });
}

export function parseSpec(json: string): VideoSpec {
  const raw = JSON.parse(json);
  // Videos made before the Just YM reel format are converted on the fly.
  if (raw.version !== 2) return fromLegacySpec(raw);
  return normalizeSpec(VideoSpecSchema.parse(raw));
}
