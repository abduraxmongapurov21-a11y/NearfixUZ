import crypto from "node:crypto";
import { OtpPurpose, Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { normalizePhone } from "../../utils/phone.js";

const OTP_TTL_MINUTES = 5;
const OTP_TTL_SECONDS = OTP_TTL_MINUTES * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_PHONE_RATE_LIMIT = 5;
const OTP_PHONE_RATE_WINDOW_MINUTES = 60;
const DEFAULT_MAX_ATTEMPTS = 5;

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

export function generateOtpCode() {
  return crypto.randomInt(1000, 10000).toString();
}

export function hashOtpCode(phone: string, code: string) {
  const normalizedPhone = normalizePhone(phone);
  return crypto.createHmac("sha256", env.ACCESS_TOKEN_SECRET).update(`${normalizedPhone}:${code}`).digest("hex");
}

export function isOtpCodeHashMatch(phone: string, code: string, codeHash: string) {
  const expectedHash = hashOtpCode(phone, code);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(codeHash, "hex");

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function otpError(message: string, status: number, code: string, extra?: Record<string, unknown>) {
  return Object.assign(new Error(message), {
    status,
    code,
    ...extra
  });
}

async function lockPhone(tx: Prisma.TransactionClient, phone: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone})::bigint)`;
}

export class OtpService {
  readonly ttlSeconds = OTP_TTL_SECONDS;
  readonly resendCooldownSeconds = OTP_RESEND_COOLDOWN_SECONDS;
  readonly phoneRateLimit = OTP_PHONE_RATE_LIMIT;
  readonly phoneRateWindowMinutes = OTP_PHONE_RATE_WINDOW_MINUTES;

  async createChallenge(phone: string, purpose: OtpPurpose, codeOverride?: string) {
    const normalizedPhone = normalizePhone(phone);

    return prisma.$transaction(async (tx) => {
      await lockPhone(tx, normalizedPhone);

      const now = new Date();
      const activeChallenge = await tx.otpChallenge.findFirst({
        where: {
          phone: normalizedPhone,
          purpose,
          consumedAt: null,
          expiresAt: {
            gt: now
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      if (activeChallenge && activeChallenge.resendAfter > now) {
        throw otpError("OTP resend cooldown is active", 429, "OTP_COOLDOWN", {
          retryAfter: Math.ceil((activeChallenge.resendAfter.getTime() - now.getTime()) / 1000)
        });
      }

      const recentCount = await tx.otpChallenge.count({
        where: {
          phone: normalizedPhone,
          createdAt: {
            gt: addMinutes(now, -OTP_PHONE_RATE_WINDOW_MINUTES)
          }
        }
      });

      if (recentCount >= OTP_PHONE_RATE_LIMIT) {
        throw otpError("OTP request rate limit exceeded", 429, "OTP_RATE_LIMITED");
      }

      await tx.otpChallenge.updateMany({
        where: {
          phone: normalizedPhone,
          purpose,
          consumedAt: null
        },
        data: {
          consumedAt: now
        }
      });

      const code = codeOverride || generateOtpCode();
      const codeHash = hashOtpCode(normalizedPhone, code);
      const challenge = await tx.otpChallenge.create({
        data: {
          phone: normalizedPhone,
          purpose,
          codeHash,
          expiresAt: addMinutes(now, OTP_TTL_MINUTES),
          attempts: 0,
          maxAttempts: DEFAULT_MAX_ATTEMPTS,
          resendAfter: addMinutes(now, OTP_RESEND_COOLDOWN_SECONDS / 60)
        }
      });

      return {
        challenge,
        code
      };
    });
  }

  async findActiveChallenge(phone: string, purpose: OtpPurpose) {
    const normalizedPhone = normalizePhone(phone);

    return prisma.otpChallenge.findFirst({
      where: {
        phone: normalizedPhone,
        purpose,
        consumedAt: null,
        expiresAt: {
          gt: new Date()
        },
        attempts: {
          lt: prisma.otpChallenge.fields.maxAttempts
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async findLatestChallenge(phone: string, purpose: OtpPurpose) {
    const normalizedPhone = normalizePhone(phone);

    return prisma.otpChallenge.findFirst({
      where: {
        phone: normalizedPhone,
        purpose
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async countRecentChallenges(phone: string) {
    const normalizedPhone = normalizePhone(phone);

    return prisma.otpChallenge.count({
      where: {
        phone: normalizedPhone,
        createdAt: {
          gt: addMinutes(new Date(), -OTP_PHONE_RATE_WINDOW_MINUTES)
        }
      }
    });
  }

  async assertCanRequest(phone: string, purpose: OtpPurpose) {
    const normalizedPhone = normalizePhone(phone);
    const now = new Date();
    const activeChallenge = await this.findActiveChallenge(normalizedPhone, purpose);

    if (activeChallenge && activeChallenge.resendAfter > now) {
      throw otpError("OTP resend cooldown is active", 429, "OTP_COOLDOWN", {
        retryAfter: Math.ceil((activeChallenge.resendAfter.getTime() - now.getTime()) / 1000)
      });
    }

    const recentCount = await this.countRecentChallenges(normalizedPhone);
    if (recentCount >= OTP_PHONE_RATE_LIMIT) {
      throw otpError("OTP request rate limit exceeded", 429, "OTP_RATE_LIMITED");
    }
  }

  async setProviderMessageId(id: string, providerMessageId?: string) {
    if (!providerMessageId) {
      return prisma.otpChallenge.findUnique({
        where: { id }
      });
    }

    return prisma.otpChallenge.update({
      where: { id },
      data: { providerMessageId }
    });
  }

  async consumeChallenge(id: string) {
    const now = new Date();

    await prisma.otpChallenge.updateMany({
      where: {
        id,
        consumedAt: null
      },
      data: {
        consumedAt: now
      }
    });

    return prisma.otpChallenge.findUnique({
      where: { id }
    });
  }

  async incrementAttempts(id: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.otpChallenge.updateMany({
        where: {
          id,
          consumedAt: null
        },
        data: {
          attempts: {
            increment: 1
          }
        }
      });

      if (updated.count !== 1) {
        throw otpError("OTP challenge is invalid", 401, "OTP_INVALID");
      }

      return tx.otpChallenge.findUniqueOrThrow({
        where: { id }
      });
    });
  }

  async invalidateExpired() {
    return prisma.otpChallenge.updateMany({
      where: {
        consumedAt: null,
        expiresAt: {
          lte: new Date()
        }
      },
      data: {
        consumedAt: new Date()
      }
    });
  }

  async verifyChallenge(phone: string, purpose: OtpPurpose, code: string) {
    const normalizedPhone = normalizePhone(phone);
    const challenge = await this.findLatestChallenge(normalizedPhone, purpose);
    const now = new Date();

    if (!challenge) {
      throw otpError("OTP challenge not found", 404, "OTP_NOT_FOUND");
    }

    if (challenge.consumedAt) {
      throw otpError("OTP challenge is invalid", 401, "OTP_INVALID");
    }

    if (challenge.expiresAt <= now) {
      await this.consumeChallenge(challenge.id);
      throw otpError("OTP challenge expired", 401, "OTP_EXPIRED");
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      await this.consumeChallenge(challenge.id);
      throw otpError("OTP challenge locked", 423, "OTP_LOCKED");
    }

    if (!isOtpCodeHashMatch(normalizedPhone, code, challenge.codeHash)) {
      const updatedChallenge = await this.incrementAttempts(challenge.id);

      if (updatedChallenge.attempts >= updatedChallenge.maxAttempts) {
        await this.consumeChallenge(challenge.id);
        throw otpError("OTP challenge locked", 423, "OTP_LOCKED");
      }

      throw otpError("Invalid OTP code", 401, "OTP_INVALID");
    }

    const consumed = await prisma.otpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: {
          gt: now
        },
        attempts: {
          lt: challenge.maxAttempts
        }
      },
      data: {
        consumedAt: now
      }
    });

    if (consumed.count !== 1) {
      throw otpError("OTP challenge is invalid", 401, "OTP_INVALID");
    }

    return challenge;
  }
}

export const otpService = new OtpService();
