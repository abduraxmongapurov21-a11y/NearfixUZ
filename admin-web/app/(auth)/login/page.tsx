"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminSessionStore } from "@/stores/admin-session-store";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const login = useAdminSessionStore((state) => state.login);

  useEffect(() => {
    const flash = window.localStorage.getItem("nearfix-admin-flash");
    if (!flash) return;
    window.localStorage.removeItem("nearfix-admin-flash");
    setMessage(flash);
  }, []);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    const result = await login(username, password);
    setIsSubmitting(false);
    if (result.ok) router.replace("/dashboard");
    else setError(result.message || "Login failed");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>NearFIX Admin</CardTitle>
          <p className="text-sm text-muted-foreground">
            Admin username va password bilan operatsion panelga kiring.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <Input
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              value={username}
            />
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
            {message ? <p className="text-sm font-medium text-green-700">{message}</p> : null}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button className="w-full" disabled={isSubmitting || !username || !password} type="submit">
              {isSubmitting ? "Kirilmoqda..." : "Kirish"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
