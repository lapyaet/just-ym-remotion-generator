import { NextResponse } from "next/server";
import { apiUser, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { user, response } = await apiUser();
  if (!user) return response;

  const render = await prisma.render.findFirst({
    where: { id: (await params).id, project: { userId: user.id } },
    select: { id: true, status: true, progress: true, error: true, createdAt: true },
  });
  if (!render) return notFound();
  return NextResponse.json(render);
}
