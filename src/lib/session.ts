import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./prisma";

const SESSION_COOKIE_NAME = "session_token";
const ACTIVE_PROFILE_COOKIE_NAME = "active_profile_id";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, { ...cookieOptions, expires: expiresAt });
}

// Cached per request render pass so multiple calls (layout + page, etc.)
// don't each hit the database.
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({ where: { token } });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { token } });
    return null;
  }

  return { userId: session.userId };
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  await clearActiveProfileId();
}

export async function clearActiveProfileId() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_PROFILE_COOKIE_NAME);
}

export async function setActiveProfileId(profileId: number) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE_NAME, String(profileId), {
    ...cookieOptions,
    expires: new Date(Date.now() + SESSION_DURATION_MS),
  });
}

// Un-verified: only for optimistic UI decisions like which profile to show
// as "active". Never use this for authorization — use requireActiveProfile.
export async function getActiveProfileIdCookie() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_PROFILE_COOKIE_NAME)?.value;
  return value ? Number(value) : null;
}

// Re-verifies the cookie's profile id belongs to the logged-in user on every
// call — the cookie is only a hint for which profile to look up, never
// trusted for authorization on its own.
export async function requireActiveProfile() {
  const session = await requireSession();
  const activeProfileId = await getActiveProfileIdCookie();
  if (activeProfileId === null) redirect("/profiles");

  const profile = await prisma.gameProfile.findFirst({
    where: { id: activeProfileId, userId: session.userId },
  });
  if (!profile) redirect("/profiles");

  return profile;
}
