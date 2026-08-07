"use server";

import { prisma } from "@/lib/prisma";
import { requireSession, setActiveProfileId } from "@/lib/session";
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

  const profile = await prisma.gameProfile.create({
    data: { userId: session.userId, name, uid: uid ?? null },
  });

  await setActiveProfileId(profile.id);
}

export async function selectProfile(profileId: number) {
  const session = await requireSession();

  const profile = await prisma.gameProfile.findFirst({
    where: { id: profileId, userId: session.userId },
  });
  if (!profile) return;

  await setActiveProfileId(profile.id);
}
