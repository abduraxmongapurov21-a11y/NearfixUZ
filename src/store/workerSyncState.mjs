export function buildWorkerProfileSyncStatus(profileResult, previousStatus, now = new Date().toISOString()) {
  if (profileResult.ok) {
    return { loading: false, error: null, isStale: false, lastSyncedAt: now };
  }

  return {
    ...previousStatus,
    loading: false,
    error: profileResult.message || "Usta profili yuklanmadi.",
    isStale: true
  };
}
