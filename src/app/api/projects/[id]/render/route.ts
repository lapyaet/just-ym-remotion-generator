import { NextResponse } from "next/server";
import { apiUser, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOwnedProject, parseSpec } from "@/lib/projects";
import { renderingAvailable, RENDER_UNAVAILABLE_MESSAGE } from "@/lib/platform";

type Ctx = { params: Promise<{ id: string }> };

/** Start an MP4 render of the project's current spec. */
export async function POST(_request: Request, { params }: Ctx) {
  const { user, response } = await apiUser();
  if (!user) return response;
  if (!renderingAvailable()) {
    return NextResponse.json({ error: RENDER_UNAVAILABLE_MESSAGE }, { status: 501 });
  }
  const project = await getOwnedProject((await params).id, user.id);
  if (!project) return notFound();

  const active = await prisma.render.findFirst({
    where: { projectId: project.id, status: { in: ["queued", "rendering"] } },
  });
  if (active) return NextResponse.json({ renderId: active.id });

  const render = await prisma.render.create({ data: { projectId: project.id } });
  // Runs in the background of this Node process (self-hosted server only).
  const { enqueueRender } = await import("@/lib/render");
  void enqueueRender(render.id, parseSpec(project.spec));
  return NextResponse.json({ renderId: render.id });
}
