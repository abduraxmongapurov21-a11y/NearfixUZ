"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSidebar } from "@/shared/components/app-sidebar";
import { canAccessAdminPath } from "@/shared/auth/navigation";
import { Topbar } from "@/shared/components/topbar";
import { useAdminSessionStore } from "@/stores/admin-session-store";

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
    else if (session?.tokenType === "admin_account" && session.mustChangePassword) router.replace("/change-password");
  }, [isSessionReady, router, session]);

  if (!isSessionReady || !session || session.mustChangePassword) return null;

  const canAccess = canAccessAdminPath(session, pathname);

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
              <h1 className="mt-2 text-2xl font-semibold">Kirish taqiqlangan</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Bu admin hisobida ushbu sahifani ochish uchun yetarli ruxsat yo'q.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
