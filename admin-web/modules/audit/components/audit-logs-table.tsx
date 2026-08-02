"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAdminAuditLogs } from "../services/audit-log-service";
import type { AdminAuditLogsQuery } from "../types/audit-log";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function metadataSummary(value: unknown) {
  if (!value || typeof value !== "object") return "-";
  return JSON.stringify(value);
}

export function AuditLogsTable() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AdminAuditLogsQuery>({ page: 1, limit: 50 });
  const [draft, setDraft] = useState({
    action: "",
    actorType: "",
    targetType: "",
    from: "",
    to: ""
  });

  const query = useQuery({
    queryKey: ["admin-audit-logs", filters, page],
    queryFn: () => getAdminAuditLogs({ ...filters, page, limit: 50 })
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters({
      action: draft.action.trim() || undefined,
      actorType: draft.actorType as AdminAuditLogsQuery["actorType"],
      targetType: draft.targetType.trim() || undefined,
      from: draft.from || undefined,
      to: draft.to || undefined,
      page: 1,
      limit: 50
    });
  }

  const result = query.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_180px_auto]" onSubmit={handleFilter}>
            <Input
              onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))}
              placeholder="Action"
              value={draft.action}
            />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              onChange={(event) => setDraft((current) => ({ ...current, actorType: event.target.value }))}
              value={draft.actorType}
            >
              <option value="">Actor type</option>
              <option value="ENV_ADMIN">ENV_ADMIN</option>
              <option value="ADMIN_ACCOUNT">ADMIN_ACCOUNT</option>
            </select>
            <Input
              onChange={(event) => setDraft((current) => ({ ...current, targetType: event.target.value }))}
              placeholder="Target type"
              value={draft.targetType}
            />
            <Input
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
              type="date"
              value={draft.from}
            />
            <Input
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
              type="date"
              value={draft.to}
            />
            <Button type="submit">
              <Search className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Created At</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Actor Type</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Metadata</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  Loading audit logs...
                </td>
              </tr>
            ) : null}
            {result?.logs.map((log) => (
              <tr className="border-b last:border-0" key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-3">{log.actorUsername || log.actorAdminId || "env-admin"}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{log.actorType}</Badge>
                </td>
                <td className="px-4 py-3 font-medium">{log.action}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {log.targetType || "-"}
                  {log.targetId ? <div className="text-xs">{log.targetId}</div> : null}
                </td>
                <td className="max-w-sm px-4 py-3">
                  <details>
                    <summary className="cursor-pointer text-muted-foreground">View</summary>
                    <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                      {metadataSummary(log.metadata)}
                    </pre>
                  </details>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{log.ipAddress || "-"}</td>
              </tr>
            ))}
            {!query.isLoading && !result?.logs.length ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  Audit logs topilmadi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {result ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Page {result.pagination.page} / {result.pagination.totalPages}, total {result.pagination.total}
          </div>
          <div className="flex gap-2">
            <Button
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={page >= result.pagination.totalPages || query.isFetching}
              onClick={() => setPage((current) => current + 1)}
              type="button"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
