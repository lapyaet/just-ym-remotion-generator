import Link from "next/link";
import { Suspense } from "react";
import { SignInButton } from "@/components/AuthButtons";
import { getSession } from "@/lib/session";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
      <p className="mb-4 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
        Claude + Remotion
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
        Type a prompt.
        <br />
        <span className="bg-gradient-to-r from-indigo-400 to-amber-300 bg-clip-text text-transparent">
          Get an animated video.
        </span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-zinc-400">
        Describe the video you want. Claude writes the scenes, colors and timing, you preview it right away in the
        browser, and Remotion renders it to MP4.
      </p>
      <div className="mt-10">
        <Suspense fallback={<div className="h-12" />}>
          <Cta />
        </Suspense>
      </div>
    </div>
  );
}

async function Cta() {
  const session = await getSession();
  if (!session) return <SignInButton />;
  return (
    <Link
      href="/dashboard"
      className="inline-flex rounded-full bg-white px-6 py-3 font-medium text-zinc-900 hover:bg-zinc-200"
    >
      Go to my videos →
    </Link>
  );
}
