"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { changeAdminPassword } from "@/services/admin-auth";
import { ApiClientError } from "@/services/api-client";
import { useAdminSessionStore } from "@/stores/admin-session-store";

function passwordValidationMessage(username: string, password: string) {
  const normalizedPassword = password.toLowerCase();
  const trivialPasswords = new Set(["admin321", "password", "password123", "12345678", "1234567890", "qwerty123"]);

  if (password.length < 10) return "Yangi parol kamida 10 ta belgidan iborat bo'lishi kerak.";
  if (trivialPasswords.has(normalizedPassword)) return "Yangi parol juda oddiy.";
  if (normalizedPassword.includes(username.toLowerCase())) return "Yangi parol foydalanuvchi nomini o'z ichiga olmasin.";
  return null;
}

function changePasswordErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.code === "INVALID_CURRENT_PASSWORD") return "Joriy parol noto'g'ri.";
    if (error.code === "INVALID_ADMIN_PASSWORD") {
      return "Yangi parol kamida 10 belgidan iborat, murakkab va foydalanuvchi nomidan farqli bo'lishi kerak.";
    }
    if (error.code === "ADMIN_ACCOUNT_REQUIRED") return "Muhit admini paroli server joylashuvi orqali boshqariladi.";
  }

  return "Parol o'zgartirilmadi.";
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const session = useAdminSessionStore((state) => state.session);
  const isSessionReady = useAdminSessionStore((state) => state.isSessionReady);
  const hydrateSession = useAdminSessionStore((state) => state.hydrateSession);
  const logout = useAdminSessionStore((state) => state.logout);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (!isSessionReady) return;
    if (!session) router.replace("/login");
    else if (session.tokenType !== "admin_account") router.replace("/dashboard");
  }, [isSessionReady, router, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    const validationError = passwordValidationMessage(session.username, newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await changeAdminPassword(session.token, { currentPassword, newPassword });
      logout();
      window.localStorage.setItem("nearfix-admin-flash", "Parol o'zgartirildi. Yangi parol bilan qayta kiring.");
      router.replace("/login");
    } catch (error) {
      setError(changePasswordErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isSessionReady || !session || session.tokenType !== "admin_account") return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Parolni o'zgartirish</CardTitle>
          <p className="text-sm text-muted-foreground">
            Boshqaruv panelidan foydalanishni davom ettirish uchun yangi parol o'rnating.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Joriy parol"
              required
              type="password"
              value={currentPassword}
            />
            <Input
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Yangi parol"
              required
              type="password"
              value={newPassword}
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button className="w-full" disabled={isSubmitting || !currentPassword || !newPassword} type="submit">
              {isSubmitting ? "Saqlanmoqda..." : "Parolni o'zgartirish"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
