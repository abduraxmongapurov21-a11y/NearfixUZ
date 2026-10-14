"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminLabel } from "@/lib/admin-labels";
import { hasPermission } from "@/shared/auth/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { getReport, getReports, moderateReview, suspendUser, updateReport, type AdminReport } from "../services/reports-service";

const statuses = ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED", "ACTION_TAKEN"];
const types = ["", "USER", "WORKER", "MESSAGE", "REVIEW", "ORDER", "SUPPORT_TICKET"];
const reasons = ["", "SPAM", "ABUSE", "HARASSMENT", "FRAUD", "INAPPROPRIATE_CONTENT", "SAFETY_RISK", "OTHER"];

export function ReportsCenter() {
  const session = useAdminSessionStore((state) => state.session);
  const canManage = hasPermission(session, "reports.manage");
  const canSuspend = canManage && hasPermission(session, "users.manage");
  const canHideReview = canManage && hasPermission(session, "reviews.manage");
  const [items, setItems] = useState<AdminReport[]>([]);
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [appliedTargetReportIds, setAppliedTargetReportIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestVersion = useRef(0);
  const detailVersion = useRef(0);
  const updateInFlight = useRef(false);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (status) query.set("status", status);
      if (targetType) query.set("targetType", targetType);
      if (reason) query.set("reason", reason);
      if (search.trim()) query.set("search", search.trim());
      const reports = await getReports(query.toString() ? `?${query}` : "");
      if (version === requestVersion.current) setItems(reports);
    } catch (value) {
      if (version === requestVersion.current) setError(value instanceof Error ? value.message : "Shikoyatlarni yuklab bo'lmadi");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [reason, search, status, targetType]);

  useEffect(() => {
    load();
    return () => { requestVersion.current += 1; };
  }, [load, refreshVersion]);

  async function open(reportId: string) {
    const version = ++detailVersion.current;
    try {
      const report = await getReport(reportId);
      if (version !== detailVersion.current) return;
      setSelected(report);
      setAdminNote(report.adminNote || "");
    } catch (value) {
      if (version === detailVersion.current) setError(value instanceof Error ? value.message : "Shikoyatni ochib bo'lmadi");
    }
  }

  async function applyStatus(reportId: string, nextStatus: string, note: string) {
    await updateReport(reportId, nextStatus, note);
    if (nextStatus === "ACTION_TAKEN") setAppliedTargetReportIds((current) => current.filter((id) => id !== reportId));
    setItems((current) => current.map((report) => report.id === reportId ? { ...report, status: nextStatus, adminNote: note } : report));
    setSelected((current) => current?.id === reportId ? { ...current, status: nextStatus, adminNote: note } : current);
    setRefreshVersion((current) => current + 1);
  }

  async function changeStatus(nextStatus: string) {
    if (!selected || !canManage || updateInFlight.current) return;
    updateInFlight.current = true;
    setUpdating(true);
    setActionError("");
    try {
      await applyStatus(selected.id, nextStatus, adminNote);
    } catch (value) {
      setActionError(value instanceof Error ? value.message : "Shikoyat holatini yangilab bo'lmadi");
    } finally {
      updateInFlight.current = false;
      setUpdating(false);
    }
  }

  async function actOnTarget(action: "suspend" | "hide") {
    if (!selected || appliedTargetReportIds.includes(selected.id) || updateInFlight.current || (action === "suspend" ? !canSuspend : !canHideReview)) return;
    const report = selected;
    const note = adminNote;
    const target = report.target || {};
    let targetApplied = false;
    let statusSaved = false;
    updateInFlight.current = true;
    setUpdating(true);
    setActionError("");
    try {
      if (action === "hide") {
        if (report.targetType !== "REVIEW") throw new Error("Sharhni aniqlab bo'lmadi");
        await moderateReview(report.targetId, "hide");
      } else {
        const userId = report.targetType === "USER"
          ? report.targetId
          : typeof target.userId === "string" ? target.userId
            : typeof target.senderId === "string" ? target.senderId : null;
        if (!userId) throw new Error("Tegishli foydalanuvchini aniqlab bo'lmadi");
        await suspendUser(userId);
      }
      targetApplied = true;
      setAppliedTargetReportIds((current) => [...current, report.id]);
      await applyStatus(report.id, "ACTION_TAKEN", note);
      statusSaved = true;
      const updatedReport = await getReport(report.id);
      setSelected((current) => current?.id === report.id ? updatedReport : current);
    } catch (value) {
      const message = value instanceof Error ? value.message : "Moderatsiya amalini bajarib bo'lmadi";
      setActionError(statusSaved
        ? `Amal bajarildi va shikoyat holati saqlandi, ammo tafsilotlarni yangilab bo'lmadi: ${message}`
        : targetApplied
          ? `Amal bajarildi, ammo shikoyat holati saqlanmadi. Holatni alohida yangilang: ${message}`
          : message);
    } finally {
      updateInFlight.current = false;
      setUpdating(false);
    }
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
          {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
          {actionError ? <p className="mt-3 text-sm text-danger" role="alert">{actionError}</p> : null}
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
              <textarea disabled={!canManage || updating} className="min-h-24 w-full rounded-md border bg-card p-3 text-sm" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Admin izohi" />
              <div className="flex flex-wrap gap-2">
                <Button disabled={!canManage || updating} variant="outline" onClick={() => changeStatus("REVIEWING")}>Ko'rib chiqilmoqda</Button>
                <Button disabled={!canManage || updating} variant="outline" onClick={() => changeStatus("RESOLVED")}>Hal qilish</Button>
                <Button disabled={!canManage || updating} variant="outline" onClick={() => changeStatus("DISMISSED")}>Rad etish</Button>
                {appliedTargetReportIds.includes(selected.id) ? <Button disabled={!canManage || updating} onClick={() => changeStatus("ACTION_TAKEN")}>Amal holatini saqlash</Button> : null}
                {selected.targetType === "REVIEW" ? <Button disabled={!canHideReview || updating || appliedTargetReportIds.includes(selected.id)} variant="outline" onClick={() => actOnTarget("hide")}>Sharhni yashirish</Button> : null}
                {["USER", "WORKER", "MESSAGE"].includes(selected.targetType) ? <Button disabled={!canSuspend || updating || appliedTargetReportIds.includes(selected.id)} onClick={() => actOnTarget("suspend")}>Foydalanuvchini to'xtatish</Button> : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
