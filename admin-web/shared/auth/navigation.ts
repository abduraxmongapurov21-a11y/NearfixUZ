import { hasPermission, isSuperAdmin, type AdminPermission, type AdminSessionLike } from "./permissions";

type NavigationSession = AdminSessionLike & { mustChangePassword?: boolean };
const routes: { href: string; prefix?: string; permissions: AdminPermission[] }[] = [
  { href: "/dashboard", permissions: ["analytics.read"] },
  { href: "/orders", permissions: ["orders.read"] },
  { href: "/workers", permissions: ["workers.read"] },
  { href: "/users", permissions: ["users.read"] },
  { href: "/reviews", permissions: ["reviews.read"] },
  { href: "/reports", permissions: ["reports.read"] },
  { href: "/support", permissions: ["support.read"] },
  { href: "/content/banners", prefix: "/content", permissions: ["content.read"] },
  { href: "/system/admins", permissions: ["admins.read", "admins.manage"] },
  { href: "/system/audit-logs", permissions: ["audit.read"] }
];

export function canAccessAdminPath(session: NavigationSession, pathname: string) {
  const route = routes.find((item) => {
    const prefix = item.prefix || item.href;
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
  return !route || isSuperAdmin(session) || route.permissions.some((permission) => hasPermission(session, permission));
}

export function getAdminLandingPath(session: NavigationSession | null) {
  if (!session) return "/login";
  if (session.tokenType === "admin_account" && session.mustChangePassword) return "/change-password";
  return routes.find((route) => canAccessAdminPath(session, route.href))?.href || "/account";
}
