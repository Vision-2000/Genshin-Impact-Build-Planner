"use server";

import { redirect } from "next/navigation";
import { clearActiveProfileId, requireSession } from "@/lib/session";

export async function changeProfile() {
  await requireSession();
  await clearActiveProfileId();
  redirect("/profiles");
}
