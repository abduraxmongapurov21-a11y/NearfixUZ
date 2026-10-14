"use client";

import Link from "next/link";
import { LogOut, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { useAdminUiStore } from "@/stores/ui-store";
import { AdminNotifications } from "./admin-notifications";

export function Topbar() {
  const router = useRouter();
  const globalSearch = useAdminUiStore((state) => state.globalSearch);
  const setGlobalSearch = useAdminUiStore((state) => state.setGlobalSearch);
  const session = useAdminSessionStore((state) => state.session);
  const logout = useAdminSessionStore((state) => state.logout);
  const initials = (session?.name || session?.username || "NF").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-8 backdrop-blur">
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={(event) => setGlobalSearch(event.target.value)}
          placeholder="Buyurtma, usta yoki foydalanuvchini qidirish"
          value={globalSearch}
        />
      </div>

      <div className="flex items-center gap-4">
        <AdminNotifications />
        {session?.tokenType === "admin_account" ? (
          <Link
            className="rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            href="/change-password"
          >
            Parolni o'zgartirish
          </Link>
        ) : null}
        <button
          className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          onClick={() => { logout(); setGlobalSearch(""); router.replace("/login"); }}
          type="button"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Chiqish
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </div>
          <div>
            <div className="text-sm font-medium">{session?.name || session?.username || "Boshqaruv admini"}</div>
            <div className="text-xs text-muted-foreground">{session?.role === "super_admin" ? "Bosh admin" : "Admin"}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
