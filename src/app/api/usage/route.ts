import { NextResponse } from "next/server";
import { apiUser } from "@/lib/api";
import { getUsage, usageJson } from "@/lib/usage";

/** Today's generation usage for the signed-in user. */
export async function GET() {
  const { user, response } = await apiUser();
  if (!user) return response;
  return NextResponse.json(usageJson(await getUsage(user)));
}
