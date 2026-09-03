import type { Metadata } from "next";
import { requireSession, getActiveProfileIdCookie } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logout } from "../(auth)/actions";
import { CreateProfileForm } from "./create-profile-form";
import { SelectProfileButton } from "./select-profile-button";
import { DeleteProfileButton } from "./delete-profile-button";

export const metadata: Metadata = {
  title: "Your Profiles",
};

export default async function ProfilesPage() {
  const session = await requireSession();
  const [profiles, activeProfileId] = await Promise.all([
    prisma.gameProfile.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
    }),
    getActiveProfileIdCookie(),
  ]);

  return (
    <div className="mx-auto min-w-0 max-w-lg space-y-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your profiles</h1>
        <form action={logout}>
          <button type="submit" className="text-sm underline">
            Log out
          </button>
        </form>
      </div>

      <ul className="space-y-2">
        {profiles.map((profile) => (
          <li key={profile.id} className="space-y-2 rounded border p-3">
            <p className="font-medium break-words">{profile.name}</p>
            {profile.uid && <p className="text-sm text-gray-500">UID: {profile.uid}</p>}
            <div className="flex items-center gap-3">
              {profile.id === activeProfileId ? (
                <span className="text-sm font-medium text-green-600">Active</span>
              ) : (
                <SelectProfileButton profileId={profile.id} />
              )}
              <DeleteProfileButton profileId={profile.id} profileName={profile.name} />
            </div>
          </li>
        ))}
        {profiles.length === 0 && <p className="text-sm text-gray-500">No profiles yet — create one below.</p>}
      </ul>

      <CreateProfileForm />
    </div>
  );
}
