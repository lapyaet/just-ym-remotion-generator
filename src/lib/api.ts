import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "./session";

/** For API routes: the signed-in user, or a 401 response. */
export async function apiUser() {
  const session = await getSession();
  if (!session) {
    return { user: null, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;
  }
  return { user: session.user, response: null } as const;
}

export function readPrompt(body: unknown): string | null {
  const prompt = (body as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== "string") return null;
  const trimmed = prompt.trim();
  return trimmed.length >= 3 && trimmed.length <= 2000 ? trimmed : null;
}

export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
