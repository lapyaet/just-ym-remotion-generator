import Link from "next/link";
import { getSession } from "@/lib/session";
import { SignInButton, SignOutButton } from "./AuthButtons";

export async function UserMenu() {
  const session = await getSession();
  if (!session) return <SignInButton compact />;

  const { user } = session;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/dashboard" className="text-zinc-300 hover:text-white">
        My videos
      </Link>
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
      ) : null}
      <SignOutButton />
    </div>
  );
}
