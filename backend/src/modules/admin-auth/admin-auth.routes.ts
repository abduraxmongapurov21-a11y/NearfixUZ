import { Router } from "express";
import { adminLoginRateLimit } from "./admin-login-rate-limit.js";
import { writeAdminAuditLog } from "./admin-audit.service.js";
import { adminChangePasswordSchema, adminLoginSchema } from "./admin-auth.contracts.js";
import { authenticateEnvAdmin } from "./admin-auth.middleware.js";
import { changeAdminPassword, loginAdmin, resolveAdminLoginAuditActor } from "./admin-auth.service.js";

export const adminAuthRouter = Router();

adminAuthRouter.post("/login", adminLoginRateLimit, async (request, response, next) => {
  let username = "";

  try {
    const input = adminLoginSchema.parse(request.body);
    username = input.username;
    const result = await loginAdmin(input);
    await writeAdminAuditLog({
      actorType: result.user.actorType,
      actorAdminId: result.user.actorType === "ADMIN_ACCOUNT" ? result.user.id : null,
      action: "admin.login_success",
      metadata: { username: result.user.username, tokenType: result.user.tokenType },
      ipAddress: request.ip,
      userAgent: request.get("user-agent") || null
    });

    response.json({
      ok: true,
      token: result.token,
      expiresIn: result.expiresIn,
      user: result.user
    });
  } catch (error) {
    const actor = await resolveAdminLoginAuditActor(username);
    await writeAdminAuditLog({
      actorType: actor.actorType,
      actorAdminId: actor.actorAdminId,
      action: "admin.login_failed",
      metadata: {
        username,
        code: typeof error === "object" && error && "code" in error ? String(error.code) : "ADMIN_LOGIN_FAILED"
      },
      ipAddress: request.ip,
      userAgent: request.get("user-agent") || null
    });
    next(error);
  }
});

adminAuthRouter.get("/me", authenticateEnvAdmin, (request, response) => {
  response.json({
    ok: true,
    user: request.user
  });
});

adminAuthRouter.post("/change-password", authenticateEnvAdmin, async (request, response, next) => {
  try {
    const input = adminChangePasswordSchema.parse(request.body);
    await changeAdminPassword(request.admin!, input);
    await writeAdminAuditLog({
      actorType: "ADMIN_ACCOUNT",
      actorAdminId: request.admin!.id,
      action: "admin.password_changed",
      targetType: "AdminAccount",
      targetId: request.admin!.id,
      metadata: { username: request.admin!.username },
      ipAddress: request.ip,
      userAgent: request.get("user-agent") || null
    });

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
