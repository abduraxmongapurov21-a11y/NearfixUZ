"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { getAdminNotifications, type AdminNotification } from "@/services/admin-notifications";
import { useAdminSessionStore } from "@/stores/admin-session-store";

export function AdminNotifications() {
  const session = useAdminSessionStore((state) => state.session);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ token: string; items: AdminNotification[]; hasError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const bell = useRef<HTMLButtonElement>(null);
  function closePanel() {
    setOpen(false);
    bell.current?.focus();
  }

  useEffect(() => {
    if (!open || !session) return;
    let current = true;
    setLoading(true);
    setResult(null);
    getAdminNotifications(session).then((value) => {
      if (current) setResult({ ...value, token: session.token });
    }).catch(() => {
      if (current) setResult({ token: session.token, items: [], hasError: true });
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [open, session, reload]);

  const visible = result?.token === session?.token ? result : null;
  return (
    <div className="relative" onKeyDown={(event) => { if (event.key === "Escape") closePanel(); }}>
      <button
        aria-controls="admin-notifications-panel"
        aria-expanded={open}
        aria-label="Bildirishnomalar"
        className="flex h-10 w-10 items-center justify-center rounded-md border bg-card text-muted-foreground hover:bg-muted"
        onClick={() => setOpen((value) => !value)}
        ref={bell}
        type="button"
      >
        <Bell className="h-4 w-4" />
      </button>
      {open ? (
        <section aria-label="Bildirishnomalar" className="absolute right-0 top-12 z-30 w-80 rounded-lg border bg-card p-4 shadow-lg" id="admin-notifications-panel">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Bildirishnomalar</h2>
            <button aria-label="Bildirishnomalarni yopish" onClick={closePanel} type="button"><X className="h-4 w-4" /></button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Ko'rib chiqilishi kutilayotgan ishlar</p>
          {loading || !visible ? <p className="mt-4 text-sm" role="status">Yuklanmoqda...</p> : (
            <>
              {visible.hasError ? (
                <div className="mt-3 text-sm text-danger" role="alert">
                  {visible.items.length ? "Bildirishnomalarning bir qismini yuklab bo'lmadi." : "Bildirishnomalarni yuklab bo'lmadi."}
                  <button className="ml-2 underline" onClick={() => setReload((value) => value + 1)} type="button">Qayta urinish</button>
                </div>
              ) : null}
              {visible.items.length ? (
                <ul className="mt-3 max-h-80 overflow-y-auto">
                  {visible.items.map((item) => (
                    <li key={item.id}>
                      <Link className="block rounded-md px-2 py-3 text-sm hover:bg-muted" href={item.href} onClick={closePanel}>{item.title}</Link>
                    </li>
                  ))}
                </ul>
              ) : !visible.hasError ? <p className="mt-4 text-sm text-muted-foreground">Bu hisob uchun kutilayotgan bildirishnomalar yo'q.</p> : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
