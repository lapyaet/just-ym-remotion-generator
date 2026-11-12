import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProjectEditor } from "@/components/ProjectEditor";
import { prisma } from "@/lib/prisma";
import { getOwnedProject, parseSpec } from "@/lib/projects";
import { requireUser } from "@/lib/session";

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading project…</p>}>
        <Project params={params} />
      </Suspense>
    </div>
  );
}

async function Project({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const project = await getOwnedProject((await params).id, user.id);
  if (!project) notFound();

  const renders = await prisma.render.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, status: true, progress: true, error: true, createdAt: true },
  });

  return (
    <ProjectEditor
      projectId={project.id}
      prompt={project.prompt}
      initialSpec={parseSpec(project.spec)}
      initialRenders={renders.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
    />
  );
}
