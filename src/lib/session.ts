import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** For pages: redirects to the landing page when signed out. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/");
  return session.user;
}
