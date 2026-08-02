import type { AuthUser } from "../modules/auth/auth-context.js";
import type { AdminContext } from "../modules/admin-auth/admin-auth.service.js";

declare global {
  namespace Express {
    interface Request {
      accessToken?: string;
      user?: AuthUser;
      admin?: AdminContext;
    }
  }
}

export {};
