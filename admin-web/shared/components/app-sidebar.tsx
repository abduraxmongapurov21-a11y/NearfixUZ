"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Flag, History, Images, LayoutDashboard, LifeBuoy, Shield, Star, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, isSuperAdmin, type AdminPermission } from "@/shared/auth/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "analytics.read" },
  { href: "/orders", label: "Orders", icon: ClipboardList, permission: "orders.read" },
  { href: "/workers", label: "Workers", icon: Wrench, permission: "workers.read" },
  { href: "/users", label: "Users", icon: Users, permission: "users.read" },
  { href: "/reviews", label: "Reviews", icon: Star, permission: "reviews.read" },
  { href: "/reports", label: "Reports", icon: Flag, permission: "reports.read" },
  { href: "/support", label: "Support", icon: LifeBuoy, permission: "support.read" }
] satisfies {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: AdminPermission;
}[];

const contentNavItems = [
  { href: "/content/banners", label: "Banners", icon: Images, permission: "content.read" }
] satisfies {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: AdminPermission;
}[];

const systemNavItems = [
  { href: "/system/admins", label: "Admins", icon: Shield, permissions: ["admins.read", "admins.manage"] },
  { href: "/system/audit-logs", label: "Audit Logs", icon: History, permissions: ["audit.read"] }
] satisfies {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permissions: AdminPermission[];
}[];

export function AppSidebar() {
  const pathname = usePathname();
  const session = useAdminSessionStore((state) => state.session);
  const visibleNavItems = navItems.filter((item) => hasPermission(session, item.permission));
  const visibleContentNavItems = contentNavItems.filter((item) => hasPermission(session, item.permission));
  const visibleSystemNavItems = systemNavItems.filter(
    (item) => isSuperAdmin(session) || item.permissions.some((permission) => hasPermission(session, permission))
  );

  function renderLink(item: { href: string; label: string; icon: typeof LayoutDashboard }) {
    const Icon = item.icon;
    const active = pathname === item.href;

    return (
      <Link
        className={cn(
          "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          active && "bg-primary/10 text-primary"
        )}
        href={item.href}
        key={item.href}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r bg-card">
      <div className="border-b px-6 py-5">
        <div className="text-xl font-semibold tracking-tight">NearFIX</div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Operations Center
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNavItems.map(renderLink)}
        {visibleContentNavItems.length ? (
          <>
            <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Content
            </div>
            {visibleContentNavItems.map(renderLink)}
          </>
        ) : null}
        {visibleSystemNavItems.length ? (
          <>
            <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              System
            </div>
            {visibleSystemNavItems.map(renderLink)}
          </>
        ) : null}
      </nav>

      <div className="border-t p-4">
        <div className="rounded-md bg-muted px-3 py-3 text-xs text-muted-foreground">
          Admin buyurtmalarni kuzatadi, worker sifatini nazorat qiladi va zarur
          holatda order statusini boshqaradi.
        </div>
      </div>
    </aside>
  );
}
