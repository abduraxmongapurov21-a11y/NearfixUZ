"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { useAdminSessionStore } from "@/stores/admin-session-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const sessionToken = useAdminSessionStore((state) => state.session?.token);
  return <SessionQueries key={sessionToken || "anonymous"}>{children}</SessionQueries>;
}

function SessionQueries({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
