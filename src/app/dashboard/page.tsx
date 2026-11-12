import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProvider, providerLabel } from "@/lib/ai";
import { PromptForm } from "@/components/PromptForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Create a video</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Describe the destination and attractions. Videos are Just YM reels (9:16) with live prices from justym.me; mention a discount only if it is real.
      </p>
      <Suspense>
        <DemoBanner />
      </Suspense>
      <div className="mt-4">
        <PromptForm />
      </div>

      <h2 className="mt-12 text-lg font-semibold">Your projects</h2>
      <Suspense fallback={<p className="mt-4 text-sm text-zinc-500">Loading…</p>}>
        <ProjectList />
      </Suspense>
    </div>
  );
}

async function DemoBanner() {
  await connection(); // read the env at request time, not build time
  if (getProvider() !== "demo") {
    return <p className="mt-2 text-xs text-zinc-500">Videos are written by: {providerLabel()}</p>;
  }
  return (
    <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
      <strong>Free demo mode:</strong> no AI is configured, so videos are built from your prompt with simple rules.
      Set <code>LLM_BASE_URL</code> (open-source model) or <code>ANTHROPIC_API_KEY</code> (Claude) in{" "}
      <code>.env</code> and restart to get AI-written videos.
    </div>
  );
}

async function ProjectList() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      prompt: true,
      updatedAt: true,
      renders: { where: { status: "done" }, select: { id: true }, take: 1 },
    },
  });

  if (projects.length === 0) {
    return <p className="mt-4 text-sm text-zinc-500">No projects yet. Your first video starts with a prompt above.</p>;
  }

  return (
    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <li key={p.id}>
          <Link
            href={`/projects/${p.id}`}
            className="block h-full rounded-xl border border-white/10 bg-white/[.03] p-4 hover:border-white/25 hover:bg-white/[.06]"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{p.title}</h3>
              {p.renders.length ? (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">MP4</span>
              ) : null}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{p.prompt}</p>
            <p className="mt-3 text-xs text-zinc-500">{p.updatedAt.toLocaleString()}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
