import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { apiUser, notFound } from "@/lib/api";
import { buildVideoRequest } from "@/lib/video-request";
import { generateVideoSpec, GenerationError } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { getOwnedProject, parseSpec } from "@/lib/projects";
import { isSafeMusicFile } from "@/remotion/music";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Revise the project's video with a follow-up prompt ({ prompt }), or just
 * change its background music without the AI ({ music: "sunny-pop.mp3" | "" }).
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const { user, response } = await apiUser();
  if (!user) return response;
  const project = await getOwnedProject((await params).id, user.id);
  if (!project) return notFound();

  const body = await request.json().catch(() => null);
  if (typeof body?.music === "string") {
    if (body.music && !isSafeMusicFile(body.music)) {
      return NextResponse.json({ error: "Unknown music track." }, { status: 400 });
    }
    const spec = { ...parseSpec(project.spec), music: body.music };
    await prisma.project.update({ where: { id: project.id }, data: { spec: JSON.stringify(spec) } });
    return NextResponse.json({ spec });
  }

  const req = await buildVideoRequest(body);
  if ("error" in req) return NextResponse.json({ error: req.error }, { status: 400 });

  try {
    const spec = await generateVideoSpec(req.text, parseSpec(project.spec));
    await prisma.project.update({
      where: { id: project.id },
      data: { title: spec.title, spec: JSON.stringify(spec) },
    });
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
