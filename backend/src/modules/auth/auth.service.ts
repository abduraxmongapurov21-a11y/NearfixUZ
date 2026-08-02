import crypto from "node:crypto";
import { OtpPurpose, Prisma, UserRole, UserStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { normalizePhone } from "../../utils/phone.js";
import { otpService, type OtpService } from "./otp.service.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { AuthProvider } from "./providers/auth-provider.interface.js";
import { createAuthProvider } from "./providers/provider.factory.js";
import { ADMIN_PERMISSIONS, type AdminPermission, isAdminRole, isSuperAdminRole } from "./permissions.js";
import {
  addDays,
  createAccessToken,
  createRawSessionToken,
  createRefreshToken,
  hashRefreshToken,
  hashSessionToken,
  verifyAccessToken
} from "./session.js";

const defaultAuthProvider = createAuthProvider();
const OTP_SESSION_TTL_SECONDS = 10 * 60;

type OtpRequestPurpose = "AUTH" | "PASSWORD_RESET";
type OtpNextStep = "PASSWORD_REQUIRED" | "PASSWORD_SETUP_REQUIRED" | "PASSWORD_RESET_REQUIRED";

type DemoAccount = {
  phone: string;
  password: string;
  role: UserRole;
};

function maskPhone(phone: string) {
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

function addSeconds(date: Date, seconds: number) {
  const next = new Date(date);
  next.setSeconds(next.getSeconds() + seconds);
  return next;
}

async function createOtpSessionToken(input: {
  phone: string;
  purpose: OtpRequestPurpose;
  nextStep: OtpNextStep;
  userId?: string;
}) {
  const rawToken = createRawSessionToken();
  const now = new Date();

  await prisma.otpSession.create({
    data: {
      tokenHash: hashSessionToken(rawToken),
      phone: input.phone,
      purpose: input.purpose,
      nextStep: input.nextStep,
      userId: input.userId,
      expiresAt: addSeconds(now, OTP_SESSION_TTL_SECONDS)
    }
  });

  return rawToken;
}

function otpSessionError(message: string, code = "INVALID_OTP_SESSION") {
  return Object.assign(new Error(message), {
    status: 401,
    code
  });
}

async function findValidOtpSession(token: string, expected: { purpose: OtpRequestPurpose; nextStep: OtpNextStep }) {
  const otpSession = await prisma.otpSession.findUnique({
    where: {
      tokenHash: hashSessionToken(token)
    }
  });
  const now = new Date();

  if (!otpSession) {
    throw otpSessionError("OTP session is invalid");
  }

  if (otpSession.expiresAt <= now) {
    throw otpSessionError("OTP session expired", "OTP_SESSION_EXPIRED");
  }

  if (otpSession.consumedAt) {
    throw otpSessionError("OTP session is invalid");
  }

  if (otpSession.purpose !== expected.purpose || otpSession.nextStep !== expected.nextStep) {
    throw otpSessionError("OTP session is invalid");
  }

  return otpSession;
}

async function consumeOtpSession(id: string) {
  const consumed = await prisma.otpSession.updateMany({
    where: {
      id,
      consumedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    data: {
      consumedAt: new Date()
    }
  });

  if (consumed.count !== 1) {
    throw otpSessionError("OTP session is invalid");
  }
}

function assertPasswordInput(password: string, confirmPassword: string) {
  if (password.length < 6) {
    throw Object.assign(new Error("Password is too short"), {
      status: 400,
      code: "PASSWORD_TOO_SHORT"
    });
  }

  if (password !== confirmPassword) {
    throw Object.assign(new Error("Password confirmation does not match"), {
      status: 400,
      code: "PASSWORD_CONFIRM_MISMATCH"
    });
  }
}

function secureEqual(left: string, right: string) {
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function demoModeDisabledError() {
  return Object.assign(new Error("App Review demo login is disabled"), {
    status: 403,
    code: "APP_REVIEW_DEMO_DISABLED"
  });
}

function invalidDemoCredentialsError() {
  return Object.assign(new Error("Invalid demo credentials"), {
    status: 401,
    code: "INVALID_CREDENTIALS"
  });
}

function passwordAuthDisabledError() {
  return Object.assign(new Error("Password auth is available only for App Review demo login"), {
    status: 410,
    code: "PASSWORD_AUTH_DISABLED"
  });
}

function configuredDemoAccounts(): DemoAccount[] {
  const accounts: DemoAccount[] = [];
  const clientPhone = env.APP_REVIEW_DEMO_CLIENT_PHONE;
  const clientPassword = env.APP_REVIEW_DEMO_CLIENT_PASSWORD;
  const workerPhone = env.APP_REVIEW_DEMO_WORKER_PHONE;
  const workerPassword = env.APP_REVIEW_DEMO_WORKER_PASSWORD;

  if (clientPhone && clientPassword) {
    accounts.push({
      phone: normalizePhone(clientPhone),
      password: clientPassword,
      role: UserRole.CLIENT
    });
  }

  if (workerPhone && workerPassword) {
    accounts.push({
      phone: normalizePhone(workerPhone),
      password: workerPassword,
      role: UserRole.PROVIDER
    });
  }

  return accounts;
}

function findDemoAccount(phone: string) {
  if (!env.APP_REVIEW_DEMO_ENABLED) return null;
  const normalizedPhone = normalizePhone(phone);
  return configuredDemoAccounts().find((account) => account.phone === normalizedPhone) || null;
}

export function isAppReviewDemoPhone(phone: string) {
  return Boolean(findDemoAccount(phone));
}

type UserWithPermissions = {
  id: string;
  phone: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  sessionVersion: number;
  adminPermissions?: { permission: string }[];
};

function permissionsForUser(user: UserWithPermissions): AdminPermission[] {
  if (isSuperAdminRole(user.role)) return [...ADMIN_PERMISSIONS];
  if (!isAdminRole(user.role)) return [];
  return (user.adminPermissions || [])
    .map((item) => item.permission)
    .filter((permission): permission is AdminPermission => (ADMIN_PERMISSIONS as readonly string[]).includes(permission));
}

function toAuthUser(user: UserWithPermissions) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role.toLowerCase(),
    permissions: permissionsForUser(user),
    sessionVersion: user.sessionVersion
  };
}

async function createSessionForUser(user: UserWithPermissions) {
  if (user.status !== UserStatus.ACTIVE) {
    throw Object.assign(new Error("User account is blocked"), {
      status: 403,
      code: "USER_BLOCKED"
    });
  }

  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = addDays(new Date(), env.SESSION_TTL_DAYS);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: refreshTokenHash,
      expiresAt
    }
  });

  const accessToken = createAccessToken({
    userId: user.id,
    sessionId: session.id,
    sessionVersion: user.sessionVersion
  });

  return {
    accessToken,
    refreshToken,
    token: accessToken,
    user: toAuthUser(user)
  };
}

function authTimingResponse(service: OtpService) {
  return {
    ok: true,
    success: true,
    expiresIn: service.ttlSeconds,
    resendIn: service.resendCooldownSeconds
  };
}

function phoneAlreadyRegisteredError() {
  return Object.assign(new Error("Phone number is already registered"), {
    status: 409,
    code: "PHONE_ALREADY_REGISTERED"
  });
}

async function deliverOtp(
  phone: string,
  purpose: OtpPurpose,
  authProvider: AuthProvider,
  service: OtpService
) {
  const { challenge, code } = await service.createChallenge(phone, purpose);

  try {
    const deliveryResult = await authProvider.sendOtp(phone, code);
    await service.setProviderMessageId(challenge.id, deliveryResult?.providerMessageId);
  } catch (error) {
    await service.consumeChallenge(challenge.id);
    throw Object.assign(new Error("SMS delivery failed"), {
      status: 502,
      code: "SMS_SEND_FAILED",
      cause: error
    });
  }
}

export async function requestRegistrationOtp(
  input: { phone: string },
  authProvider: AuthProvider = defaultAuthProvider,
  service: OtpService = otpService
) {
  const phone = normalizePhone(input.phone);
  const existingUser = await prisma.user.findUnique({
    where: { phone },
    select: { id: true }
  });

  if (existingUser) {
    throw phoneAlreadyRegisteredError();
  }

  await deliverOtp(phone, OtpPurpose.REGISTER, authProvider, service);
  return authTimingResponse(service);
}

export async function requestLegacyOtp(
  input: { phone: string },
  authProvider: AuthProvider = defaultAuthProvider,
  service: OtpService = otpService
) {
  const phone = normalizePhone(input.phone);
  const existingUser = await prisma.user.findUnique({
    where: { phone },
    select: { status: true }
  });

  if (existingUser?.status === UserStatus.BLOCKED) {
    throw Object.assign(new Error("User account is blocked"), {
      status: 403,
      code: "USER_BLOCKED"
    });
  }

  await deliverOtp(phone, OtpPurpose.REGISTER, authProvider, service);
  return authTimingResponse(service);
}

export async function requestAuthOtp(
  input: { phone: string; purpose?: OtpRequestPurpose },
  authProvider: AuthProvider = defaultAuthProvider,
  service: OtpService = otpService
) {
  const purpose = input.purpose || "AUTH";
  const phone = normalizePhone(input.phone);

  if (purpose !== "AUTH") {
    throw passwordAuthDisabledError();
  }

  if (purpose === "AUTH" && isAppReviewDemoPhone(phone)) {
    return {
      ok: true,
      success: true,
      nextStep: "APP_REVIEW_PASSWORD_REQUIRED"
    };
  }

  return requestLegacyOtp({ phone }, authProvider, service);
}

export async function verifyAuthOtp(input: { phone: string; code: string; purpose?: OtpRequestPurpose }, service: OtpService = otpService) {
  const phone = normalizePhone(input.phone);
  const purpose = input.purpose || "AUTH";

  if (purpose === "PASSWORD_RESET") {
    throw passwordAuthDisabledError();
  }

  await service.verifyChallenge(phone, OtpPurpose.REGISTER, input.code);

  let user = await prisma.user.findUnique({
    where: { phone },
    include: {
      adminPermissions: true
    }
  });

  if (user?.status === UserStatus.BLOCKED) {
    throw Object.assign(new Error("User account is blocked"), {
      status: 403,
      code: "USER_BLOCKED"
    });
  }

  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          phone,
          role: UserRole.CLIENT
        },
        include: {
          adminPermissions: true
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        user = await prisma.user.findUniqueOrThrow({
          where: { phone },
          include: {
            adminPermissions: true
          }
        });
      } else {
        throw error;
      }
    }
  }

  return createSessionForUser(user);
}

export async function loginWithAppReviewDemo(input: { phone: string; password: string }) {
  const demoAccount = findDemoAccount(input.phone);
  if (!env.APP_REVIEW_DEMO_ENABLED) throw demoModeDisabledError();
  if (!demoAccount || !secureEqual(input.password, demoAccount.password)) throw invalidDemoCredentialsError();

  const user = await prisma.user.findUnique({
    where: {
      phone: demoAccount.phone
    },
    include: {
      adminPermissions: true
    }
  });

  if (!user || user.role !== demoAccount.role || user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
    throw invalidDemoCredentialsError();
  }

  return createSessionForUser(user);
}

export async function loginWithPassword(input: { otpSessionToken: string; password: string }) {
  const otpSession = await findValidOtpSession(input.otpSessionToken, {
    purpose: "AUTH",
    nextStep: "PASSWORD_REQUIRED"
  });
  const phone = normalizePhone(otpSession.phone);
  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      adminPermissions: true
    }
  });

  const passwordMatches = await verifyPassword(input.password, user?.passwordHash);

  if (!user || !user.passwordHash || !passwordMatches) {
    throw Object.assign(new Error("Invalid password"), {
      status: 401,
      code: "INVALID_PASSWORD"
    });
  }

  if (otpSession.userId && user.id !== otpSession.userId) {
    throw otpSessionError("OTP session is invalid");
  }

  await consumeOtpSession(otpSession.id);

  return createSessionForUser(user);
}

export async function setupPasswordAfterOtp(input: {
  otpSessionToken: string;
  password: string;
  confirmPassword: string;
}) {
  assertPasswordInput(input.password, input.confirmPassword);

  const otpSession = await findValidOtpSession(input.otpSessionToken, {
    purpose: "AUTH",
    nextStep: "PASSWORD_SETUP_REQUIRED"
  });
  const phone = normalizePhone(otpSession.phone);
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const existingUser = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true,
      status: true,
      passwordHash: true
    }
  });

  if (
    existingUser?.status === UserStatus.BLOCKED ||
    existingUser?.passwordHash ||
    (otpSession.userId && existingUser?.id !== otpSession.userId)
  ) {
    throw otpSessionError("OTP session is invalid");
  }

  let user: UserWithPermissions;
  await consumeOtpSession(otpSession.id);

  if (existingUser) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          passwordSetAt: now,
          passwordChangedAt: now,
          sessionVersion: {
            increment: 1
          }
        }
      }),
      prisma.session.updateMany({
        where: {
          userId: existingUser.id,
          revoked: false
        },
        data: {
          revoked: true
        }
      })
    ]);

    user = await prisma.user.findUniqueOrThrow({
      where: { id: existingUser.id },
      include: {
        adminPermissions: true
      }
    });
  } else {
    try {
      user = await prisma.user.create({
        data: {
          phone,
          passwordHash,
          passwordSetAt: now,
          passwordChangedAt: now,
          role: UserRole.CLIENT
        },
        include: {
          adminPermissions: true
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw otpSessionError("OTP session is invalid");
      }
      throw error;
    }
  }

  return createSessionForUser(user);
}

export async function requestForgotPasswordOtp(
  input: { phone: string },
  authProvider: AuthProvider = defaultAuthProvider,
  service: OtpService = otpService
) {
  const phone = normalizePhone(input.phone);
  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      status: true
    }
  });

  if (user?.status === UserStatus.ACTIVE) {
    try {
      await deliverOtp(phone, OtpPurpose.PASSWORD_RESET, authProvider, service);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "OTP_REQUEST_FAILED";
      console.warn(`[password-reset-otp] ${maskPhone(phone)} request not sent: ${code}`);
    }
  }

  return authTimingResponse(service);
}

export async function resetPasswordAfterOtp(input: {
  otpSessionToken: string;
  password: string;
  confirmPassword: string;
}) {
  assertPasswordInput(input.password, input.confirmPassword);

  const otpSession = await findValidOtpSession(input.otpSessionToken, {
    purpose: "PASSWORD_RESET",
    nextStep: "PASSWORD_RESET_REQUIRED"
  });
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { phone: normalizePhone(otpSession.phone) },
    select: {
      id: true,
      status: true
    }
  });

  if (!user || user.status !== UserStatus.ACTIVE || (otpSession.userId && user.id !== otpSession.userId)) {
    throw otpSessionError("OTP session is invalid");
  }

  await consumeOtpSession(otpSession.id);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordSetAt: now,
        passwordChangedAt: now,
        sessionVersion: {
          increment: 1
        }
      }
    }),
    prisma.session.updateMany({
      where: {
        userId: user.id,
        revoked: false
      },
      data: {
        revoked: true
      }
    })
  ]);

  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      adminPermissions: true
    }
  });

  return createSessionForUser(updatedUser);
}


export async function getSessionUser(rawToken: string) {
  const payload = verifyAccessToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: { include: { adminPermissions: true } } }
  });

  if (!session || session.revoked || session.expiresAt <= new Date()) {
    throw Object.assign(new Error("Session is expired or revoked"), {
      status: 401,
      code: "SESSION_INVALID"
    });
  }

  if (session.userId !== payload.userId || payload.sessionVersion !== session.user.sessionVersion) {
    throw Object.assign(new Error("Profile updated. Please login again."), {
      status: 401,
      code: "SESSION_VERSION_MISMATCH"
    });
  }

  if (session.user.status !== UserStatus.ACTIVE) {
    throw Object.assign(new Error("User account is blocked"), {
      status: 403,
      code: "USER_BLOCKED"
    });
  }

  return {
    ...toAuthUser(session.user),
    sessionId: session.id,
  };
}

export async function revokeSession(rawToken: string) {
  const payload = verifyAccessToken(rawToken);

  await prisma.session.updateMany({
    where: {
      id: payload.sessionId,
      revoked: false
    },
    data: {
      revoked: true
    }
  });
}

export async function updateCurrentUserProfile(userId: string, input: { name: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name.trim()
    },
    include: {
      adminPermissions: true
    }
  });

  return toAuthUser(user);
}

export async function refreshAccessToken(rawRefreshToken: string) {
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);

  const session = await prisma.session.findUnique({
    where: { refreshToken: refreshTokenHash },
    include: { user: { include: { adminPermissions: true } } }
  });

  if (!session || session.revoked || session.expiresAt <= new Date()) {
    throw Object.assign(new Error("Refresh session is expired or revoked"), {
      status: 401,
      code: "REFRESH_SESSION_INVALID"
    });
  }

  if (session.user.status !== UserStatus.ACTIVE) {
    throw Object.assign(new Error("User account is blocked"), {
      status: 403,
      code: "USER_BLOCKED"
    });
  }

  const accessToken = createAccessToken({
    userId: session.userId,
    sessionId: session.id,
    sessionVersion: session.user.sessionVersion
  });

  return {
    accessToken,
    token: accessToken,
    user: toAuthUser(session.user)
  };
}

export async function promoteClientToProvider(userId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const user = await tx.user.update({
    where: { id: userId },
    data: {
      role: UserRole.PROVIDER,
      sessionVersion: {
        increment: 1
      }
    }
  });

  await tx.workerProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      status: "DRAFT"
    }
  });

  const workerProfile = await tx.workerProfile.findUniqueOrThrow({
    where: { userId }
  });

  await tx.workerAvailability.upsert({
    where: { workerId: workerProfile.id },
    update: {},
    create: {
      workerId: workerProfile.id,
      status: "OFFLINE"
    }
  });

  await tx.session.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true }
  });

  return user;
}
