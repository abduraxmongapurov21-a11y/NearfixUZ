"use client";

import { useAdminSessionStore } from "@/stores/admin-session-store";

export default function AccountPage() {
  const session = useAdminSessionStore((state) => state.session);
  return (
    <section className="rounded-lg border bg-card p-8">
      <h1 className="text-2xl font-semibold">Admin hisobi</h1>
      <p className="mt-2 text-muted-foreground">{session?.name || session?.username}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Bu hisob uchun boshqaruv sahifalarini ko'rish ruxsati tayinlanmagan. Kerakli ruxsatlarni olish uchun bosh adminga murojaat qiling.
      </p>
    </section>
  );
}
