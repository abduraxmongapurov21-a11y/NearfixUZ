export function normalizePhoneNumber(rawValue: string): string | null {
  const compact = rawValue.trim().replace(/[\s()-]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;

  const digits = compact.replace(/^\+/, '');
  const normalizedDigits = digits.length === 9 ? `998${digits}` : digits;
  if (normalizedDigits.length < 8 || normalizedDigits.length > 15) return null;

  return `+${normalizedDigits}`;
}
