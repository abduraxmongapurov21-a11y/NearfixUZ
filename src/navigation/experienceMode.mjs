export function defaultExperienceModeForRole(role) {
  return role === "provider" ? "worker" : "client";
}

export function normalizeExperienceMode(role, mode) {
  if (role !== "provider") return "client";
  return mode === "client" ? "client" : "worker";
}

export function rootExperienceForSession(session) {
  return normalizeExperienceMode(session?.role, session?.experienceMode) === "worker" ? "worker" : "discovery";
}
