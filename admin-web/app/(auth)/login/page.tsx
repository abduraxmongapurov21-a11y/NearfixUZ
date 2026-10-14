"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { getAdminLandingPath } from "@/shared/auth/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    if (result.ok) router.replace(getAdminLandingPath(useAdminSessionStore.getState().session));
    else setError(result.message || "Kirish amalga oshmadi");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>NearFIX boshqaruv paneli</CardTitle>
          <p className="text-sm text-muted-foreground">
            Admin foydalanuvchi nomi va paroli bilan boshqaruv paneliga kiring.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <Input
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Foydalanuvchi nomi"
              value={username}
            />
            <div className="relative">
              <Input
                autoComplete="current-password"
                className="pr-12"
                id="admin-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Parol"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <Button
                aria-controls="admin-password"
                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword((visible) => !visible)}
                size="icon"
                type="button"
                variant="ghost"
              >
                {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </Button>
            </div>
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
