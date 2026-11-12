import "server-only";
import { prisma } from "./prisma";
import { normalizeSpec, VideoSpecSchema, type VideoSpec } from "@/remotion/schema";

/** Returns the project only if it belongs to the user. */
export async function getOwnedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, userId } });
}

export function parseSpec(json: string): VideoSpec {
  return normalizeSpec(VideoSpecSchema.parse(JSON.parse(json)));
}
