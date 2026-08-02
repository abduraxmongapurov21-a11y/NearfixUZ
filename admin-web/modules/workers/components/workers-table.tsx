"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/shared/components/data-table";
import { FilterBar } from "@/shared/components/filter-bar";
import { useWorkers } from "../hooks/use-workers";
import { approveWorker, rejectWorker, suspendWorker, unsuspendWorker } from "../services/workers-service";
import { workersColumns } from "../tables/workers-columns";
import type { AdminWorker } from "../types/worker";

type WorkerModerationAction = "approve" | "reject" | "suspend" | "unsuspend";

export function WorkersTable() {
  const { data = [] } = useWorkers();
  const queryClient = useQueryClient();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ workerId: string; action: WorkerModerationAction } | null>(null);
  const pendingWorkers = data.filter((worker) => worker.status === "draft" && worker.submittedAt);
  const approvedWorkers = data.filter((worker) => worker.status === "approved");
  const suspendedWorkers = data.filter((worker) => worker.status === "suspended");
  const moderationMutation = useMutation({
    mutationFn: ({ worker, action }: { worker: AdminWorker; action: WorkerModerationAction }) => {
      if (action === "approve") return approveWorker(worker);
      if (action === "reject") return rejectWorker(worker);
      if (action === "suspend") return suspendWorker(worker);
      return unsuspendWorker(worker);
    },
    onMutate: ({ worker, action }) => {
      setPendingAction({ workerId: worker.id, action });
      setSuccessMessage(null);
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Worker moderation bajarilmadi");
    },
    onSuccess: async () => {
      setSuccessMessage("Worker holati yangilandi.");
      await queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
    onSettled: () => {
      setPendingAction(null);
    }
  });

  function isPending(workerId: string, action: WorkerModerationAction) {
    return pendingAction?.workerId === workerId && pendingAction.action === action;
  }

  function runAction(worker: AdminWorker, action: WorkerModerationAction) {
    if (moderationMutation.isPending) return;
    moderationMutation.mutate({ worker, action });
  }

  return (
    <div className="space-y-6">
      {successMessage ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {successMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMessage}
        </div>
      ) : null}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            NEW
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {pendingWorkers.length}
            </span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Provider role olgan, lekin hali admin tasdig'idan o'tmagan ustalar.
          </p>
        </CardHeader>
        <CardContent>
          {pendingWorkers.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {pendingWorkers.map((worker) => (
                <div key={worker.id} className="rounded-lg border bg-background p-4">
                  {(() => {
                    const missingFields = getMissingFields(worker);
                    return (
                      <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <button
                        className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!worker.profileImageUrl}
                        onClick={() => worker.profileImageUrl && setPreviewImage(worker.profileImageUrl)}
                        type="button"
                      >
                        {worker.profileImageUrl ? (
                          <>
                            <span
                              className="block h-full w-full bg-cover bg-center"
                              style={{ backgroundImage: `url("${worker.profileImageUrl}")` }}
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition hover:bg-black/35 hover:opacity-100">
                              <ZoomIn className="h-5 w-5" />
                            </span>
                          </>
                        ) : (
                          <span className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] font-semibold text-muted-foreground">
                            Rasm yo'q
                          </span>
                        )}
                      </button>
                      <div>
                        <div className="font-semibold">{worker.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{worker.phone}</div>
                      </div>
                    </div>
                    <Button
                      disabled={moderationMutation.isPending || missingFields.length > 0}
                      onClick={() => runAction(worker, "approve")}
                      size="sm"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {isPending(worker.id, "approve") ? "Tasdiqlanmoqda..." : "Tasdiqlash"}
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
                    <Info label="Sohalar" value={worker.professions.join(", ") || worker.profession} />
                    <Info label="Tajriba" value={`${worker.experienceYears || 0} yil`} />
                    <Info label="Narx" value={worker.basePrice ? `${worker.basePrice.toLocaleString("uz-UZ")} so'mdan` : "Kiritilmagan"} />
                    <Info label="Shahar" value={worker.city} />
                  </div>
                  {worker.bio ? <p className="mt-3 text-sm text-muted-foreground">{worker.bio}</p> : null}
                  {missingFields.length ? (
                    <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                      To'ldirilmagan: {missingFields.join(", ")}
                    </div>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <Button
                      disabled={moderationMutation.isPending}
                      onClick={() => runAction(worker, "reject")}
                      size="sm"
                      variant="outline"
                    >
                      {isPending(worker.id, "reject") ? "Rad etilmoqda..." : "Rad etish"}
                    </Button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Hozircha yangi usta arizalari yo'q.
            </div>
          )}
        </CardContent>
      </Card>
      <FilterBar filters={["Status", "City", "Profession"]} searchPlaceholder="Worker yoki kasb qidirish" />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Approved</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              ...workersColumns,
              {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => (
                  <Button
                    disabled={moderationMutation.isPending}
                    onClick={() => runAction(row.original, "suspend")}
                    size="sm"
                    variant="outline"
                  >
                    {isPending(row.original.id, "suspend") ? "Suspending..." : "Suspend"}
                  </Button>
                )
              }
            ]}
            data={approvedWorkers}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Suspended</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              ...workersColumns,
              {
                id: "actions",
                header: "Actions",
                cell: ({ row }) => (
                  <Button
                    disabled={moderationMutation.isPending}
                    onClick={() => runAction(row.original, "unsuspend")}
                    size="sm"
                  >
                    {isPending(row.original.id, "unsuspend") ? "Unsuspending..." : "Unsuspend"}
                  </Button>
                )
              }
            ]}
            data={suspendedWorkers}
          />
        </CardContent>
      </Card>
      {previewImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setPreviewImage(null)}>
          <div className="relative h-[min(82vh,760px)] w-[min(92vw,760px)] rounded-lg bg-background p-3 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <button
              className="absolute right-3 top-3 z-10 rounded-full bg-background/90 p-2 shadow"
              onClick={() => setPreviewImage(null)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-full w-full rounded-md bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${previewImage}")` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function getMissingFields(worker: {
  name: string;
  city: string;
  profession: string;
  professions: string[];
  experienceYears: number;
  profileImageUrl?: string;
  basePrice: number;
  bio?: string;
}) {
  const missing: string[] = [];

  if (!worker.name || worker.name === "Kiritilmagan") missing.push("Ism");
  if (!worker.city || worker.city === "Kiritilmagan") missing.push("Shahar");
  if (!worker.profession && !worker.professions.length) missing.push("Soha");
  if (!worker.experienceYears) missing.push("Tajriba");
  if (!worker.profileImageUrl) missing.push("Rasm");
  if (!worker.basePrice) missing.push("Narx");
  if (!worker.bio?.trim()) missing.push("Bio");

  return missing;
}
