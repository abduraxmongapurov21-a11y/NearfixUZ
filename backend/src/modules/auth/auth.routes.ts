import { Router, type RequestHandler } from "express";
import {
  appReviewLoginSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshTokenSchema,
  registerOtpRequestSchema,
  updateCurrentUserSchema
} from "./auth.contracts.js";
import { authenticate } from "./middleware/auth.middleware.js";
import { otpRequestIpRateLimit } from "./middleware/otp-ip-rate-limit.js";
import { deleteCurrentUserAccount } from "./account-deletion.service.js";
import {
  loginWithAppReviewDemo,
  requestAuthOtp,
  refreshAccessToken,
  requestRegistrationOtp,
  revokeSession,
  verifyAuthOtp,
  updateCurrentUserProfile
} from "./auth.service.js";

export const authRouter = Router();

const requestRegistrationOtpHandler: RequestHandler = async (request, response, next) => {
  try {
    const input = registerOtpRequestSchema.parse(request.body);
    const result = await requestRegistrationOtp(input);

    response.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

const verifyRegistrationOtpHandler: RequestHandler = async (request, response, next) => {
  try {
    const input = otpVerifySchema.parse(request.body);
    const result = await verifyAuthOtp(input);

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const requestLegacyOtpHandler: RequestHandler = async (request, response, next) => {
  try {
    const input = otpRequestSchema.parse(request.body);
    const result = await requestAuthOtp(input);

    response.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

const verifyLegacyOtpHandler: RequestHandler = async (request, response, next) => {
  try {
    const input = otpVerifySchema.parse(request.body);
    const result = await verifyAuthOtp(input);

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

authRouter.post("/otp/request", otpRequestIpRateLimit, requestLegacyOtpHandler);
authRouter.post("/register/otp/request", otpRequestIpRateLimit, requestRegistrationOtpHandler);
authRouter.post("/otp/verify", verifyLegacyOtpHandler);
authRouter.post("/register/otp/verify", verifyRegistrationOtpHandler);

authRouter.post("/app-review/login", otpRequestIpRateLimit, async (request, response, next) => {
  try {
    const input = appReviewLoginSchema.parse(request.body);
    const result = await loginWithAppReviewDemo(input);

    response.json({
      ok: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      token: result.token,
      user: result.user
    });
  } catch (error) {
    next(error);
  }
});

const passwordAuthDisabledHandler: RequestHandler = (_request, response) => {
  response.status(410).json({
    ok: false,
    code: "PASSWORD_AUTH_DISABLED",
    message: "Password auth is available only through /auth/app-review/login."
  });
};

authRouter.post("/password/login", passwordAuthDisabledHandler);
authRouter.post("/login", passwordAuthDisabledHandler);
authRouter.post("/password/setup", passwordAuthDisabledHandler);
authRouter.post("/password/reset", passwordAuthDisabledHandler);
authRouter.post("/password/forgot/request", passwordAuthDisabledHandler);
authRouter.post("/password/forgot/verify", passwordAuthDisabledHandler);

authRouter.get("/me", authenticate, (request, response) => {
  const user = request.user!;

  response.json({
    ok: true,
    user: {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      sessionVersion: user.sessionVersion
    }
  });
});

authRouter.patch("/me", authenticate, async (request, response, next) => {
  try {
    const input = updateCurrentUserSchema.parse(request.body);
    const user = await updateCurrentUserProfile(request.user!.id, input);

    response.json({
      ok: true,
      user
    });
  } catch (error) {
    next(error);
  }
});

authRouter.delete("/me", authenticate, async (request, response, next) => {
  try {
    const result = await deleteCurrentUserAccount(request.user!.id);

    response.json({
      ok: true,
      deleted: true,
      deletedAt: result.deletedAt
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (request, response, next) => {
  try {
    const input = refreshTokenSchema.parse(request.body);
    const result = await refreshAccessToken(input.refreshToken);

    response.json({
      ok: true,
      accessToken: result.accessToken,
      token: result.token,
      user: result.user
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", authenticate, async (request, response, next) => {
  try {
    await revokeSession(request.accessToken || "");

    response.json({
      ok: true
    });
  } catch (error) {
    next(error);
  }
});
