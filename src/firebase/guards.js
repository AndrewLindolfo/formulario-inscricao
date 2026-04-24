import { ensureAdminProfile, getAdminProfile } from "./firestore";

export async function requireAdminAccess(user) {
  if (!user) {
    return { allowed: false, reason: "not-authenticated" };
  }

  const profile = (await getAdminProfile(user.uid)) || (await ensureAdminProfile(user));

  if (!profile) {
    return { allowed: false, reason: "admin-profile-not-found" };
  }

  return { allowed: true, profile };
}
