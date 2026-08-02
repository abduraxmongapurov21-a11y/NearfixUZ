"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { hasPermission, isSuperAdmin, type AdminPermission } from "@/shared/auth/permissions";
import { Topbar } from "@/shared/components/topbar";
import { useAdminSessionStore } from "@/stores/admin-session-store";

const routePermissions: {
  prefix: string;
  permission?: AdminPermission;
  anyPermission?: AdminPermission[];
  superAdminOnly?: boolean;
}[] = [
  { prefix: "/dashboard", permission: "analytics.read" },
  { prefix: "/orders", permission: "orders.read" },
  { prefix: "/workers", permission: "workers.read" },
  { prefix: "/users", permission: "users.read" },
  { prefix: "/reviews", permission: "reviews.read" },
  { prefix: "/reports", permission: "reports.read" },
  { prefix: "/support", permission: "support.read" },
  { prefix: "/content", permission: "content.read" },
  { prefix: "/system/admins", anyPermission: ["admins.read", "admins.manage"] },
  { prefix: "/system/audit-logs", permission: "audit.read" }
];

function canAccessPath(session: { role: string; permissions: string[] }, pathname: string) {
  const rule = routePermissions.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`));
  if (!rule) return true;
  if (rule.superAdminOnly) return isSuperAdmin(session);
  if (rule.anyPermission) return isSuperAdmin(session) || rule.anyPermission.some((permission) => hasPermission(session, permission));
  return rule.permission ? hasPermission(session, rule.permission) : true;
}

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAdminSessionStore((state) => state.session);
  const isSessionReady = useAdminSessionStore((state) => state.isSessionReady);
  const hydrateSession = useAdminSessionStore((state) => state.hydrateSession);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (isSessionReady && !session) router.replace("/login");
  }, [isSessionReady, router, session]);

  if (!isSessionReady || !session) return null;

  const canAccess = canAccessPath(session, pathname);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="min-h-screen pl-72">
        <Topbar />
        <main className="px-8 py-6">
          {canAccess ? (
            children
          ) : (
            <div className="rounded-lg border bg-card p-8">
              <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">403</div>
              <h1 className="mt-2 text-2xl font-semibold">Access denied</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                This admin account does not have permission to open this page.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
