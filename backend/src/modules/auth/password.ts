import bcrypt from "bcryptjs";

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_BYTES = 72;

const PASSWORD_SALT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("nearfix-invalid-password", PASSWORD_SALT_ROUNDS);

export function isPasswordWithinBcryptLimit(password: string) {
  return Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES;
}

export function assertPasswordValid(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw Object.assign(new Error("Password is too short"), {
      status: 400,
      code: "PASSWORD_TOO_SHORT"
    });
  }

  if (!isPasswordWithinBcryptLimit(password)) {
    throw Object.assign(new Error("Password does not meet security requirements"), {
      status: 400,
      code: "INVALID_PASSWORD"
    });
  }
}

export async function hashPassword(password: string) {
  assertPasswordValid(password);
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash?: string | null) {
  return bcrypt.compare(password, passwordHash || DUMMY_PASSWORD_HASH);
}
