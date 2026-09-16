"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminLabel } from "@/lib/admin-labels";
import { getReport, getReports, moderateReview, suspendUser, updateReport, type AdminReport } from "../services/reports-service";

const statuses = ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED", "ACTION_TAKEN"];
const types = ["", "USER", "WORKER", "MESSAGE", "REVIEW", "ORDER", "SUPPORT_TICKET"];
const reasons = ["", "SPAM", "ABUSE", "HARASSMENT", "FRAUD", "INAPPROPRIATE_CONTENT", "SAFETY_RISK", "OTHER"];

export function ReportsCenter() {
  const [items, setItems] = useState<AdminReport[]>([]);
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (status) query.set("status", status);
      if (targetType) query.set("targetType", targetType);
      if (reason) query.set("reason", reason);
      if (search.trim()) query.set("search", search.trim());
      setItems(await getReports(query.toString() ? `?${query}` : ""));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Shikoyatlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [reason, search, status, targetType]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(reportId: string) {
    try {
      const report = await getReport(reportId);
      setSelected(report);
      setAdminNote(report.adminNote || "");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Shikoyatni ochib bo'lmadi");
    }
  }

  async function changeStatus(nextStatus: string) {
    if (!selected) return;
    await updateReport(selected.id, nextStatus, adminNote);
    await load();
    await open(selected.id);
  }

  async function actOnTarget(action: "suspend" | "hide") {
    if (!selected) return;
    const target = selected.target || {};
    if (action === "hide" && selected.targetType === "REVIEW") await moderateReview(selected.targetId, "hide");
    if (action === "suspend") {
      const userId =
        selected.targetType === "USER"
          ? selected.targetId
          : typeof target.userId === "string"
            ? target.userId
            : typeof target.senderId === "string"
              ? target.senderId
              : null;
      if (!userId) throw new Error("Tegishli foydalanuvchini aniqlab bo'lmadi");
      await suspendUser(userId);
    }
    await changeStatus("ACTION_TAKEN");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <Card>
        <CardHeader><CardTitle>Shikoyatlar navbati</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 md:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, shikoyatchi yoki tafsilot" />
            <select className="h-10 rounded-md border bg-card px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Barcha holatlar</option>{statuses.map((item) => <option key={item} value={item}>{adminLabel(item)}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-card px-3 text-sm" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
              <option value="">Barcha obyektlar</option>{types.filter(Boolean).map((item) => <option key={item} value={item}>{adminLabel(item)}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-card px-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="">Barcha sabablar</option>{reasons.filter(Boolean).map((item) => <option key={item} value={item}>{adminLabel(item)}</option>)}
            </select>
          </div>
          <Button onClick={load} disabled={loading}>{loading ? "Yuklanmoqda..." : "Filtrlarni qo'llash"}</Button>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <button key={item.id} onClick={() => open(item.id)} className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-muted">
                <div><div className="font-medium">{adminLabel(item.targetType)} · {adminLabel(item.reason)}</div><div className="text-xs text-muted-foreground">{item.reporter.name || item.reporter.phone} · {new Date(item.createdAt).toLocaleString("uz-UZ")}</div></div>
                <Badge variant={item.status === "PENDING" ? "warning" : item.status === "ACTION_TAKEN" ? "danger" : "secondary"}>{adminLabel(item.status)}</Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Shikoyat tafsilotlari</CardTitle></CardHeader>
        <CardContent>
          {!selected ? <p className="text-sm text-muted-foreground">Shikoyatni tanlang.</p> : (
            <div className="space-y-4">
              <div className="text-sm"><b>Shikoyatchi:</b> {selected.reporter.name || selected.reporter.phone}</div>
              <div className="text-sm"><b>Obyekt:</b> {adminLabel(selected.targetType)} / {selected.targetId}</div>
              <div className="text-sm"><b>Sabab:</b> {adminLabel(selected.reason)}</div>
              <div className="rounded-md bg-muted p-3 text-sm">{selected.details || "Tafsilot kiritilmagan."}</div>
              <pre className="max-h-56 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(selected.target, null, 2)}</pre>
              <textarea className="min-h-24 w-full rounded-md border bg-card p-3 text-sm" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Admin izohi" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => changeStatus("REVIEWING")}>Ko'rib chiqilmoqda</Button>
                <Button variant="outline" onClick={() => changeStatus("RESOLVED")}>Hal qilish</Button>
                <Button variant="outline" onClick={() => changeStatus("DISMISSED")}>Rad etish</Button>
                {selected.targetType === "REVIEW" ? <Button variant="outline" onClick={() => actOnTarget("hide")}>Sharhni yashirish</Button> : null}
                {["USER", "WORKER", "MESSAGE"].includes(selected.targetType) ? <Button onClick={() => actOnTarget("suspend")}>Foydalanuvchini to'xtatish</Button> : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
