import { redirect } from "next/navigation";
import { getSession, getActiveProfileIdCookie } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Un-verified hint (same contract as everywhere else this cookie is
  // read) -- good enough for "which page should this land on", since a
  // stale/invalid id just means /characters' own requireActiveProfile()
  // bounces back to /profiles anyway, same as if this always redirected
  // there. Landing on /profiles with no way back to the app otherwise
  // (short of logging out and back in) was the actual bug this fixes.
  const activeProfileId = await getActiveProfileIdCookie();
  redirect(activeProfileId !== null ? "/characters" : "/profiles");
}
