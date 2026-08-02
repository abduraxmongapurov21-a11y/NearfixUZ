import { z } from "zod";
import { isPasswordWithinBcryptLimit } from "./password.js";

const phoneSchema = z.string().min(7).max(32);
const otpPurposeSchema = z.enum(["AUTH", "PASSWORD_RESET"]).default("AUTH");

const loginPasswordSchema = z
  .string()
  .min(1)
  .refine(isPasswordWithinBcryptLimit, "Password must not exceed 72 UTF-8 bytes");

const otpCodeSchema = z.string().regex(/^\d{4,12}$/);
const passwordInputSchema = z.string().min(1);
const otpSessionTokenSchema = z.string().min(32);

export const otpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: otpPurposeSchema.optional().default("AUTH")
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  purpose: otpPurposeSchema.optional().default("AUTH")
});

export const registerOtpRequestSchema = z.object({
  phone: phoneSchema
});

export const passwordLoginSchema = z.object({
  otpSessionToken: otpSessionTokenSchema,
  password: loginPasswordSchema
});

export const passwordSetupSchema = z.object({
  otpSessionToken: otpSessionTokenSchema,
  password: passwordInputSchema,
  confirmPassword: passwordInputSchema
});

export const passwordResetSchema = z.object({
  otpSessionToken: otpSessionTokenSchema,
  password: passwordInputSchema,
  confirmPassword: passwordInputSchema
});

export const appReviewLoginSchema = z.object({
  phone: phoneSchema,
  password: loginPasswordSchema
});

export const forgotPasswordOtpRequestSchema = z.object({
  phone: phoneSchema
});

export const updateCurrentUserSchema = z.object({
  name: z.string().min(2).max(80)
});

export const bearerTokenSchema = z
  .string()
  .startsWith("Bearer ")
  .transform((value) => value.slice("Bearer ".length).trim());

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32)
});
