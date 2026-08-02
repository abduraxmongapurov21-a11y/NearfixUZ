export function resolveWorkerImage(worker) {
  if (worker?.profileImageUrl) {
    return { uri: worker.profileImageUrl };
  }

  return worker?.image ? { uri: worker.image } : null;
}

export function getInitials(value) {
  const words = String(value || "NF")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "NF";
}

export const onboardingImages = {
  trust: {
    uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/36d640ec91-fb99036d991401f15a16.png"
  },
  booking: {
    uri: "https://storage.googleapis.com/uxpilot-auth.appspot.com/36d640ec91-b3c6eff8c6f50704c670.png"
  }
};
