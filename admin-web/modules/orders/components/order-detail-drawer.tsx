"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminOrderDetail } from "@/contracts/admin";
import type { AdminOrderAction } from "../services/orders-service";

type OrderDetailDrawerProps = {
  open: boolean;
  order?: AdminOrderDetail;
  isLoading?: boolean;
  actionError?: string | null;
  actionSuccess?: string | null;
  pendingAction?: AdminOrderAction | null;
  onClose: () => void;
  onAction?: (action: AdminOrderAction) => void;
};

function valueOrDash(value?: string | number | null) {
  if (value === undefined || value === null || value === "") return "-";
  return value;
}

function formatAmount(value?: number | null) {
  if (value === undefined || value === null) return "-";
  return `${value.toLocaleString("uz-UZ")} so'm`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium text-foreground">{valueOrDash(value)}</span>
    </div>
  );
}

function getAvailableActions(status?: string): { action: AdminOrderAction; label: string }[] {
  const value = status?.toUpperCase();

  if (value === "WAITING_RESPONSE" || value === "WAITING") {
    return [
      { action: "accept", label: "Accept Order" },
      { action: "cancel", label: "Cancel Order" }
    ];
  }

  if (value === "ACCEPTED") {
    return [
      { action: "on_the_way", label: "Mark On The Way" },
      { action: "cancel", label: "Cancel Order" }
    ];
  }

  if (value === "ON_THE_WAY") {
    return [
      { action: "in_progress", label: "Mark In Progress" },
      { action: "cancel", label: "Cancel Order" }
    ];
  }

  if (value === "IN_PROGRESS") {
    return [
      { action: "completed", label: "Mark Completed" },
      { action: "cancel", label: "Cancel Order" }
    ];
  }

  return [];
}

export function OrderDetailDrawer({
  open,
  order,
  isLoading,
  actionError,
  actionSuccess,
  pendingAction,
  onClose,
  onAction
}: OrderDetailDrawerProps) {
  if (!open) return null;

  const actions = getAvailableActions(order?.status);

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l bg-background shadow-xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Order detail</p>
            <h2 className="text-lg font-semibold text-foreground">{order?.publicCode || "Loading"}</h2>
          </div>
          <Button aria-label="Close order detail" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              Order detail yuklanmoqda...
            </div>
          ) : order ? (
            <div className="space-y-4">
              <section className="rounded-md border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {actions.length ? (
                    actions.map((item) => (
                      <Button
                        disabled={Boolean(pendingAction)}
                        key={item.action}
                        onClick={() => onAction?.(item.action)}
                        variant={item.action === "cancel" ? "outline" : "default"}
                      >
                        {pendingAction === item.action ? "Processing..." : item.label}
                      </Button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Read only</p>
                  )}
                </div>
                {actionSuccess ? <p className="mt-3 text-sm text-green-600">{actionSuccess}</p> : null}
                {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
              </section>

              <Section title="Order Information">
                <Field label="Order ID" value={order.id} />
                <Field label="Public Code" value={order.publicCode} />
                <Field label="Status" value={order.status} />
                <Field label="Created At" value={order.createdAt} />
                <Field label="City" value={order.city} />
                <Field label="Service" value={order.service} />
                <Field label="Problem Title" value={order.problemTitle} />
                <Field label="Problem Description" value={order.problemDescription} />
                <Field label="Price Estimate" value={formatAmount(order.priceEstimate)} />
                <Field label="Final Amount" value={formatAmount(order.finalAmount)} />
                <Field label="Response Deadline" value={order.responseDeadline} />
                <Field label="Cancel Reason" value={order.cancelReason} />
              </Section>

              <Section title="Client Information">
                <Field label="Client ID" value={order.client.id} />
                <Field label="Name" value={order.client.name} />
                <Field label="Phone" value={order.client.phone} />
              </Section>

              <Section title="Worker Information">
                <Field label="Worker ID" value={order.worker.id} />
                <Field label="Name" value={order.worker.name} />
                <Field label="Phone" value={order.worker.phone} />
                <Field label="Profession" value={order.worker.profession} />
                <Field label="Availability" value={order.worker.availability} />
              </Section>

              <Section title="Address Information">
                {order.address ? (
                  <>
                    <Field label="Label" value={order.address.label} />
                    <Field label="City" value={order.address.cityId} />
                    <Field label="District" value={order.address.district} />
                    <Field label="Address" value={order.address.addressText} />
                    <Field
                      label="Coordinates"
                      value={
                        order.address.lat && order.address.lng
                          ? `${order.address.lat}, ${order.address.lng}`
                          : null
                      }
                    />
                  </>
                ) : (
                  <p className="text-muted-foreground">Address ma'lumoti yo'q.</p>
                )}
              </Section>

              <Section title="Payment Information">
                {order.payments.length ? (
                  <div className="space-y-3">
                    {order.payments.map((payment) => (
                      <div className="rounded-md border p-3" key={payment.id}>
                        <Field label="Provider" value={payment.provider} />
                        <Field label="Status" value={payment.status} />
                        <Field label="Amount" value={formatAmount(payment.amount)} />
                        <Field label="External ID" value={payment.externalId} />
                        <Field label="Created At" value={payment.createdAt} />
                        <Field label="Updated At" value={payment.updatedAt} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Payment yozuvlari yo'q.</p>
                )}
              </Section>

              <Section title="Timeline Information">
                {order.timeline.length ? (
                  <div className="space-y-3">
                    {order.timeline.map((event) => (
                      <div className="rounded-md border p-3" key={event.id}>
                        <Field label="Created At" value={event.createdAt} />
                        <Field label="Event Type" value={event.eventType} />
                        <Field label="Actor Type" value={event.actorType} />
                        <Field
                          label="Status Change"
                          value={
                            event.fromStatus || event.toStatus
                              ? `${valueOrDash(event.fromStatus)} -> ${valueOrDash(event.toStatus)}`
                              : null
                          }
                        />
                        <Field label="Message" value={event.message} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Timeline yozuvlari yo'q.</p>
                )}
              </Section>
            </div>
          ) : (
            <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              Order detail topilmadi.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
