const STATUS_COPY = Object.freeze({
  DRAFT: "Qoralama",
  SUBMITTED: "Yuborilgan",
  REJECTED: "Rad etilgan",
  APPROVED: "Tasdiqlangan",
  SUSPENDED: "To'xtatilgan"
});

export const WORKER_APPLICATION_STATES = Object.freeze(Object.keys(STATUS_COPY));

export function workerApplicationStatusCopy(state) {
  return STATUS_COPY[String(state || "").toUpperCase()] || "Noma'lum";
}
