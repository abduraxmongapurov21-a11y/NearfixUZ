import { Router, type Request } from "express";
import { authenticate } from "../auth/middleware/auth.middleware.js";
import {
  adminPermissionSchema,
  createAdminSchema,
  replaceAdminPermissionsSchema,
  resetAdminPasswordSchema,
  updateAdminSchema
} from "./admin-management.contracts.js";
import {
  createAdmin,
  disableAdmin,
  enableAdmin,
  grantPermissionToAdmin,
  listAdmins,
  replaceAdminPermissions,
  resetAdminPassword,
  revokePermissionFromAdmin,
  updateAdmin
} from "./admin-management.service.js";

export const adminManagementRouter = Router();

adminManagementRouter.use(authenticate);

function requestMeta(request: Request) {
  return {
    ipAddress: request.ip,
    userAgent: request.get("user-agent") || null
  };
}

function requireAdminContext(request: Request) {
  if (!request.admin) {
    throw Object.assign(new Error("Admin token required"), {
      status: 401,
      code: "ADMIN_UNAUTHORIZED"
    });
  }

  return request.admin;
}

adminManagementRouter.get("/", async (request, response, next) => {
  try {
    const admins = await listAdmins(requireAdminContext(request));
    response.json({ ok: true, admins });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.post("/", async (request, response, next) => {
  try {
    const input = createAdminSchema.parse(request.body);
    const admin = await createAdmin(requireAdminContext(request), input, requestMeta(request));
    response.status(201).json({ ok: true, admin });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.patch("/:adminId", async (request, response, next) => {
  try {
    const input = updateAdminSchema.parse(request.body);
    const admin = await updateAdmin(requireAdminContext(request), String(request.params.adminId), input, requestMeta(request));
    response.json({ ok: true, admin });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.patch("/:adminId/password", async (request, response, next) => {
  try {
    const input = resetAdminPasswordSchema.parse(request.body);
    const admin = await resetAdminPassword(requireAdminContext(request), String(request.params.adminId), input, requestMeta(request));
    response.json({ ok: true, admin });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.patch("/:adminId/permissions", async (request, response, next) => {
  try {
    const input = replaceAdminPermissionsSchema.parse(request.body);
    const admin = await replaceAdminPermissions(
      requireAdminContext(request),
      String(request.params.adminId),
      input.permissions,
      requestMeta(request)
    );
    response.json({ ok: true, admin });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.patch("/:adminId/disable", async (request, response, next) => {
  try {
    const admin = await disableAdmin(requireAdminContext(request), String(request.params.adminId), requestMeta(request));
    response.json({ ok: true, admin });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.patch("/:adminId/enable", async (request, response, next) => {
  try {
    const admin = await enableAdmin(requireAdminContext(request), String(request.params.adminId), requestMeta(request));
    response.json({ ok: true, admin });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.post("/:adminId/permissions", async (request, response, next) => {
  try {
    const input = adminPermissionSchema.parse(request.body);
    const admin = await grantPermissionToAdmin(
      requireAdminContext(request),
      String(request.params.adminId),
      input.permission,
      requestMeta(request)
    );
    response.json({ ok: true, admin });
  } catch (error) {
    next(error);
  }
});

adminManagementRouter.delete("/:adminId/permissions/:permission", async (request, response, next) => {
  try {
    const input = adminPermissionSchema.parse({ permission: request.params.permission });
    const admin = await revokePermissionFromAdmin(
      requireAdminContext(request),
      String(request.params.adminId),
      input.permission,
      requestMeta(request)
    );
    response.json({ ok: true, admin });
  } catch (error) {
    next(error);
  }
});
