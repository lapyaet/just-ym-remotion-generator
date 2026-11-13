import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { apiUser, notFound } from "@/lib/api";
import { buildVideoRequest } from "@/lib/video-request";
import { generateVideoSpec, GenerationError } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { getUsage, limitMessage, recordGeneration, usageJson } from "@/lib/usage";
import { getOwnedProject, parseSpec } from "@/lib/projects";
import { isSafeMusicFile } from "@/remotion/music";
import { TEMPLATE_IDS } from "@/remotion/templates";
import type { VideoSpec } from "@/remotion/schema";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Revise the project's video with a follow-up prompt ({ prompt }), or change
 * its design without the AI ({ music?, template?, seed? }).
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const { user, response } = await apiUser();
  if (!user) return response;
  const project = await getOwnedProject((await params).id, user.id);
  if (!project) return notFound();

  const body = await request.json().catch(() => null);

  // Design-only changes (no AI): music track, template, variation seed.
  if (body && ("music" in body || "template" in body || "seed" in body || "sfx" in body) && !body.prompt && !body.brief && !body.referenceUrl) {
    const spec = parseSpec(project.spec);
    if (typeof body.music === "string") {
      if (body.music && !isSafeMusicFile(body.music)) return NextResponse.json({ error: "Unknown music track." }, { status: 400 });
      spec.music = body.music;
    }
    if (typeof body.template === "string") {
      if (!(TEMPLATE_IDS as readonly string[]).includes(body.template)) return NextResponse.json({ error: "Unknown template." }, { status: 400 });
      spec.template = body.template as VideoSpec["template"];
    }
    if (typeof body.seed === "number" && Number.isFinite(body.seed)) spec.seed = Math.abs(Math.floor(body.seed)) % 2 ** 31;
    if (typeof body.sfx === "boolean") spec.sfx = body.sfx;
    await prisma.project.update({ where: { id: project.id }, data: { spec: JSON.stringify(spec) } });
    return NextResponse.json({ spec });
  }

  const usage = await getUsage(user);
  if (usage.remaining <= 0) {
    return NextResponse.json({ error: limitMessage(usage), usage: usageJson(usage) }, { status: 429 });
  }

  const req = await buildVideoRequest(body);
  if ("error" in req) return NextResponse.json({ error: req.error }, { status: 400 });

  try {
    const spec = await generateVideoSpec(req.text, parseSpec(project.spec), { userId: user.id });
    await prisma.project.update({
      where: { id: project.id },
      data: { title: spec.title, spec: JSON.stringify(spec) },
    });
    await recordGeneration(user.id, "revise");
    return NextResponse.json({ spec });
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error(error);
    return NextResponse.json({ error: "Something went wrong revising the video." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { user, response } = await apiUser();
  if (!user) return response;
  const project = await getOwnedProject((await params).id, user.id);
  if (!project) return notFound();

  const renders = await prisma.render.findMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await Promise.all(renders.map((r) => (r.outputPath ? fs.rm(r.outputPath, { force: true }) : null)));
  return NextResponse.json({ ok: true });
}
