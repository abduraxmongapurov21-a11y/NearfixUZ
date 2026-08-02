"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      setError(value instanceof Error ? value.message : "Reports could not be loaded");
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
      setError(value instanceof Error ? value.message : "Report could not be opened");
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
      if (!userId) throw new Error("Target user could not be resolved");
      await suspendUser(userId);
    }
    await changeStatus("ACTION_TAKEN");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <Card>
        <CardHeader><CardTitle>Reports queue</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2 md:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, reporter, details" />
            <select className="h-10 rounded-md border bg-card px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-card px-3 text-sm" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
              <option value="">All targets</option>{types.filter(Boolean).map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-card px-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="">All reasons</option>{reasons.filter(Boolean).map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <Button onClick={load} disabled={loading}>{loading ? "Loading..." : "Apply filters"}</Button>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <button key={item.id} onClick={() => open(item.id)} className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-muted">
                <div><div className="font-medium">{item.targetType} · {item.reason}</div><div className="text-xs text-muted-foreground">{item.reporter.name || item.reporter.phone} · {new Date(item.createdAt).toLocaleString()}</div></div>
                <Badge variant={item.status === "PENDING" ? "warning" : item.status === "ACTION_TAKEN" ? "danger" : "secondary"}>{item.status}</Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Report detail</CardTitle></CardHeader>
        <CardContent>
          {!selected ? <p className="text-sm text-muted-foreground">Select a report.</p> : (
            <div className="space-y-4">
              <div className="text-sm"><b>Reporter:</b> {selected.reporter.name || selected.reporter.phone}</div>
              <div className="text-sm"><b>Target:</b> {selected.targetType} / {selected.targetId}</div>
              <div className="text-sm"><b>Reason:</b> {selected.reason}</div>
              <div className="rounded-md bg-muted p-3 text-sm">{selected.details || "No details provided."}</div>
              <pre className="max-h-56 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(selected.target, null, 2)}</pre>
              <textarea className="min-h-24 w-full rounded-md border bg-card p-3 text-sm" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Admin note" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => changeStatus("REVIEWING")}>Mark reviewing</Button>
                <Button variant="outline" onClick={() => changeStatus("RESOLVED")}>Resolve</Button>
                <Button variant="outline" onClick={() => changeStatus("DISMISSED")}>Dismiss</Button>
                {selected.targetType === "REVIEW" ? <Button variant="outline" onClick={() => actOnTarget("hide")}>Hide review</Button> : null}
                {["USER", "WORKER", "MESSAGE"].includes(selected.targetType) ? <Button onClick={() => actOnTarget("suspend")}>Suspend user</Button> : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
