"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { useAdminUiStore } from "@/stores/ui-store";

export function Topbar() {
  const globalSearch = useAdminUiStore((state) => state.globalSearch);
  const setGlobalSearch = useAdminUiStore((state) => state.setGlobalSearch);
  const session = useAdminSessionStore((state) => state.session);
  const initials = (session?.name || session?.username || "NF").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-8 backdrop-blur">
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={(event) => setGlobalSearch(event.target.value)}
          placeholder="Order, worker yoki user qidirish"
          value={globalSearch}
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="flex h-10 w-10 items-center justify-center rounded-md border bg-card text-muted-foreground">
          <Bell className="h-4 w-4" />
        </button>
        {session?.tokenType === "admin_account" ? (
          <Link
            className="rounded-md border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            href="/change-password"
          >
            Change password
          </Link>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </div>
          <div>
            <div className="text-sm font-medium">{session?.name || session?.username || "Operations Admin"}</div>
            <div className="text-xs text-muted-foreground">{session?.role === "super_admin" ? "Super admin" : "Admin"}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
