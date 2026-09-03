"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, setActiveProfileId, getActiveProfileIdCookie, clearActiveProfileId } from "@/lib/session";
import { CreateProfileSchema, type CreateProfileFormState } from "./schemas";

export async function createProfile(
  _state: CreateProfileFormState,
  formData: FormData
): Promise<CreateProfileFormState> {
  const session = await requireSession();

  const validated = CreateProfileSchema.safeParse({
    name: formData.get("name"),
    uid: formData.get("uid") || undefined,
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, uid } = validated.data;

  await prisma.gameProfile.create({
    data: { userId: session.userId, name, uid: uid ?? null },
  });

  revalidatePath("/profiles");
}

export async function selectProfile(profileId: number) {
  const session = await requireSession();

  const profile = await prisma.gameProfile.findFirst({
    where: { id: profileId, userId: session.userId },
  });
  if (!profile) return;

  await setActiveProfileId(profile.id);
  // Stand-in destination until a real profile home page exists.
  redirect("/characters");
}

// Cascades (DB-level, onDelete: Cascade) through everything scoped to this
// profile -- owned characters/weapons/artifacts, builds, teams, rosters, and
// lineups. The confirm prompt on the client names this before calling in.
export async function deleteProfile(profileId: number) {
  const session = await requireSession();

  const [activeProfileId] = await Promise.all([
    getActiveProfileIdCookie(),
    prisma.gameProfile.deleteMany({ where: { id: profileId, userId: session.userId } }),
  ]);

  if (activeProfileId === profileId) {
    await clearActiveProfileId();
  }

  revalidatePath("/profiles");
}
