export const OTHER_WORKER_CANCELLATION_REASON = "Boshqa sabab";

export const WORKER_CANCELLATION_REASONS = Object.freeze([
  "Hozir bandman",
  "Manzil uzoq",
  "Kerakli asbob yo'q",
  "Vaqt to'g'ri kelmaydi",
  OTHER_WORKER_CANCELLATION_REASON
]);

export function resolveWorkerCancellationReason(selectedReason, customReason) {
  if (!WORKER_CANCELLATION_REASONS.includes(selectedReason)) return "";
  const reason = selectedReason === OTHER_WORKER_CANCELLATION_REASON ? customReason : selectedReason;
  const normalized = String(reason || "").trim();
  return normalized.length >= 3 && normalized.length <= 240 ? normalized : "";
}
