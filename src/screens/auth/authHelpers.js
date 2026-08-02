export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Telefon raqam yoki parol noto'g'ri.",
  PHONE_ALREADY_REGISTERED: "Bu telefon raqam allaqachon ro'yxatdan o'tgan.",
  OTP_NOT_FOUND: "Tasdiqlash kodi topilmadi. Yangi kod so'rang.",
  OTP_INVALID: "Tasdiqlash kodi noto'g'ri.",
  OTP_EXPIRED: "Tasdiqlash kodining muddati tugagan. Yangi kod so'rang.",
  OTP_LOCKED: "Juda ko'p noto'g'ri urinish bo'ldi. Yangi kod so'rang.",
  OTP_COOLDOWN: "Yangi kod yuborish uchun biroz kuting.",
  OTP_RATE_LIMITED: "Juda ko'p kod so'raldi. Keyinroq qayta urinib ko'ring.",
  SMS_SEND_FAILED: "SMS yuborilmadi. Keyinroq qayta urinib ko'ring.",
  INVALID_PASSWORD: "Parol noto'g'ri.",
  INVALID_OTP_SESSION: "Tasdiqlash sessiyasi yaroqsiz. SMS kodni qayta tasdiqlang.",
  OTP_SESSION_EXPIRED: "Tasdiqlash sessiyasi muddati tugagan. SMS kodni qayta tasdiqlang.",
  PASSWORD_TOO_SHORT: "Parol kamida 6 ta belgidan iborat bo'lishi kerak.",
  PASSWORD_CONFIRM_MISMATCH: "Parollar mos emas.",
  APP_REVIEW_DEMO_DISABLED: "Demo kirish vaqtincha o'chirilgan.",
  USER_BLOCKED: "Bu hisob bloklangan. Yordam xizmatiga murojaat qiling."
};

export function authErrorMessage(result, fallback) {
  return AUTH_ERROR_MESSAGES[result?.code] || result?.message || fallback;
}

export function normalizeUzPhone(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return `+${trimmed.replace(/\D/g, "")}`;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("998")) return `+${digits}`;
  return `+998${digits}`;
}

export function isValidUzPhone(phone) {
  return /^\+998\d{9}$/.test(phone);
}

export function isValidOtp(code) {
  return /^\d{4,12}$/.test(code.trim());
}

export function passwordValidationMessage(password) {
  if (password.length < 6) return "Parol kamida 6 ta belgidan iborat bo'lishi kerak.";
  if (password.length > 72) return "Parol 72 ta belgidan oshmasligi kerak.";
  return "";
}
