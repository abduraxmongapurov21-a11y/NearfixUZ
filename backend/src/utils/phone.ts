export function normalizePhone(phone: string) {
  const trimmed = phone.trim();

  if (!/^\+?[\d\s()-]+$/.test(trimmed) || (trimmed.includes("+") && !trimmed.startsWith("+"))) {
    throw Object.assign(new Error("Invalid phone number"), {
      status: 400,
      code: "INVALID_PHONE_NUMBER"
    });
  }

  const digits = phone.replace(/\D/g, "");
  const normalizedDigits = digits.startsWith("998") ? digits : `998${digits}`;

  if (!/^998\d{9}$/.test(normalizedDigits)) {
    throw Object.assign(new Error("Invalid phone number"), {
      status: 400,
      code: "INVALID_PHONE_NUMBER"
    });
  }

  return `+${normalizedDigits}`;
}
