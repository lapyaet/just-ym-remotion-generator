import { NextResponse } from "next/server";
import { apiUser, readPrompt } from "@/lib/api";
import { generateVideoSpec, GenerationError } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

/** Create a new project: prompt -> AI -> video spec. */
export async function POST(request: Request) {
  const { user, response } = await apiUser();
  if (!user) return response;

  const prompt = readPrompt(await request.json().catch(() => null));
  if (!prompt) {
    return NextResponse.json({ error: "Prompt must be 3-2000 characters." }, { status: 400 });
  }

  try {
    const spec = await generateVideoSpec(prompt);
    const project = await prisma.project.create({
      data: { userId: user.id, prompt, title: spec.title, spec: JSON.stringify(spec) },
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
