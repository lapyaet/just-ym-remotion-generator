import { NextResponse } from "next/server";
import { apiUser } from "@/lib/api";
import { buildVideoRequest } from "@/lib/video-request";
import { generateVideoSpec, GenerationError } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

/** Create a new project: prompt / attached .md brief / reference reel link -> AI -> video spec. */
export async function POST(request: Request) {
  const { user, response } = await apiUser();
  if (!user) return response;

  const req = await buildVideoRequest(await request.json().catch(() => null));
  if ("error" in req) return NextResponse.json({ error: req.error }, { status: 400 });

  try {
    const spec = await generateVideoSpec(req.text, undefined, { userId: user.id });
    const project = await prisma.project.create({
      data: { userId: user.id, prompt: req.summary, title: spec.title, spec: JSON.stringify(spec) },
    });
    return NextResponse.json({ id: project.id });
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error(error);
    return NextResponse.json({ error: "Something went wrong generating the video." }, { status: 500 });
  }
}
