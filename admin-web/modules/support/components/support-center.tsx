"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupportTickets, updateSupportTicket, type AdminSupportTicket } from "../services/support-service";

const statuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export function SupportCenter() {
  const [items, setItems] = useState<AdminSupportTicket[]>([]);
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (filter) query.set("status", filter);
      if (search.trim()) query.set("search", search.trim());
      setItems(await getSupportTickets(query.toString() ? `?${query}` : ""));
    } catch (value) {
      setError(value instanceof Error ? value.message : "Support tickets could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(status: string) {
    if (!selected) return;
    try {
      await updateSupportTicket(selected.id, status, adminNote);
      await load();
      setSelected((current) => current ? { ...current, status, adminNote } : current);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Support ticket could not be updated");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader><CardTitle>Support queue</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-3 flex gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ticket, user, order or reason" />
            <select className="h-10 rounded-md border bg-card px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
            <Button onClick={load} disabled={loading}>{loading ? "Loading..." : "Filter"}</Button>
          </div>
          {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
          <div className="space-y-2">
            {items.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => { setSelected(ticket); setAdminNote(ticket.adminNote || ""); }}
                className="flex w-full items-center justify-between rounded-md border p-3 text-left hover:bg-muted"
              >
                <div>
                  <div className="font-medium">{ticket.reason}</div>
                  <div className="text-xs text-muted-foreground">{ticket.user.name || ticket.user.phone} · {ticket.order?.publicCode || "No order"}</div>
                </div>
                <Badge variant={ticket.status === "OPEN" ? "warning" : ticket.status === "RESOLVED" ? "success" : "secondary"}>{ticket.status}</Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ticket detail</CardTitle></CardHeader>
        <CardContent>
          {!selected ? <p className="text-sm text-muted-foreground">Select a support ticket.</p> : (
            <div className="space-y-4">
              <div className="text-sm"><b>User:</b> {selected.user.name || selected.user.phone}</div>
              <div className="text-sm"><b>Reason:</b> {selected.reason}</div>
              <div className="rounded-md bg-muted p-3 text-sm">{selected.message || "No message provided."}</div>
              {selected.order ? <div className="text-sm"><b>Order:</b> {selected.order.publicCode} · {selected.order.status}</div> : null}
              <textarea className="min-h-28 w-full rounded-md border bg-card p-3 text-sm" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Internal admin note" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => changeStatus("IN_PROGRESS")}>In progress</Button>
                <Button variant="outline" onClick={() => changeStatus("RESOLVED")}>Resolve</Button>
                <Button variant="outline" onClick={() => changeStatus("CLOSED")}>Close</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
