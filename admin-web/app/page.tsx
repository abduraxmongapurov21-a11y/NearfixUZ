"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAdminLandingPath } from "@/shared/auth/navigation";
import { useAdminSessionStore } from "@/stores/admin-session-store";

export default function HomePage() {
  const router = useRouter();
  const session = useAdminSessionStore((state) => state.session);
  const ready = useAdminSessionStore((state) => state.isSessionReady);
  const hydrateSession = useAdminSessionStore((state) => state.hydrateSession);
  useEffect(() => { hydrateSession(); }, [hydrateSession]);
  useEffect(() => { if (ready) router.replace(getAdminLandingPath(session)); }, [ready, router, session]);
  return null;
}
