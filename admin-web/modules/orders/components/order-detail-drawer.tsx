"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminOrderDetail } from "@/contracts/admin";
import { adminLabel } from "@/lib/admin-labels";
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
      { action: "accept", label: "Buyurtmani qabul qilish" },
      { action: "cancel", label: "Buyurtmani bekor qilish" }
    ];
  }

  if (value === "ACCEPTED") {
    return [
      { action: "on_the_way", label: "Yo'lga chiqdi deb belgilash" },
      { action: "cancel", label: "Buyurtmani bekor qilish" }
    ];
  }

  if (value === "ON_THE_WAY") {
    return [
      { action: "in_progress", label: "Ish boshlandi deb belgilash" },
      { action: "cancel", label: "Buyurtmani bekor qilish" }
    ];
  }

  if (value === "IN_PROGRESS") {
    return [
      { action: "completed", label: "Bajarildi deb belgilash" },
      { action: "cancel", label: "Buyurtmani bekor qilish" }
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
            <p className="text-xs font-medium text-muted-foreground">Buyurtma tafsilotlari</p>
            <h2 className="text-lg font-semibold text-foreground">{order?.publicCode || "Yuklanmoqda"}</h2>
          </div>
          <Button aria-label="Buyurtma tafsilotlarini yopish" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              Buyurtma tafsilotlari yuklanmoqda...
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
                        {pendingAction === item.action ? "Bajarilmoqda..." : item.label}
                      </Button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Faqat ko'rish uchun</p>
                  )}
                </div>
                {actionSuccess ? <p className="mt-3 text-sm text-green-600">{actionSuccess}</p> : null}
                {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
              </section>

              <Section title="Buyurtma ma'lumotlari">
                <Field label="Buyurtma ID raqami" value={order.id} />
                <Field label="Ochiq kod" value={order.publicCode} />
                <Field label="Holat" value={adminLabel(order.status)} />
                <Field label="Yaratilgan vaqti" value={order.createdAt} />
                <Field label="Shahar" value={adminLabel(order.city)} />
                <Field label="Xizmat" value={order.service} />
                <Field label="Muammo sarlavhasi" value={order.problemTitle} />
                <Field label="Muammo tavsifi" value={order.problemDescription} />
                <Field label="Taxminiy narx" value={formatAmount(order.priceEstimate)} />
                <Field label="Yakuniy summa" value={formatAmount(order.finalAmount)} />
                <Field label="Javob muddati" value={order.responseDeadline} />
                <Field label="Bekor qilish sababi" value={order.cancelReason} />
              </Section>

              <Section title="Mijoz ma'lumotlari">
                <Field label="Mijoz ID raqami" value={order.client.id} />
                <Field label="Ism" value={order.client.name} />
                <Field label="Telefon" value={order.client.phone} />
              </Section>

              <Section title="Usta ma'lumotlari">
                <Field label="Usta ID raqami" value={order.worker.id} />
                <Field label="Ism" value={order.worker.name} />
                <Field label="Telefon" value={order.worker.phone} />
                <Field label="Kasb" value={order.worker.profession} />
                <Field label="Bandlik holati" value={adminLabel(order.worker.availability)} />
              </Section>

              <Section title="Manzil ma'lumotlari">
                {order.location ? (
                  <>
                    <Field label="Nomi" value={order.location.label} />
                    <Field label="Shahar" value={adminLabel(order.location.cityId)} />
                    <Field label="Tuman" value={order.location.district} />
                    <Field label="Manzil" value={order.location.addressText} />
                    <Field
                      label="Koordinatalar"
                      value={
                        order.location.lat && order.location.lng
                          ? `${order.location.lat}, ${order.location.lng}`
                          : null
                      }
                    />
                  </>
                ) : (
                  <p className="text-muted-foreground">Manzil ma'lumoti yo'q.</p>
                )}
              </Section>

              <Section title="To'lov ma'lumotlari">
                {order.payments.length ? (
                  <div className="space-y-3">
                    {order.payments.map((payment) => (
                      <div className="rounded-md border p-3" key={payment.id}>
                        <Field label="To'lov tizimi" value={payment.provider} />
                        <Field label="Holat" value={adminLabel(payment.status)} />
                        <Field label="Summa" value={formatAmount(payment.amount)} />
                        <Field label="Tashqi ID raqami" value={payment.externalId} />
                        <Field label="Yaratilgan vaqti" value={payment.createdAt} />
                        <Field label="Yangilangan vaqti" value={payment.updatedAt} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">To'lov yozuvlari yo'q.</p>
                )}
              </Section>

              <Section title="Buyurtma tarixi">
                {order.timeline.length ? (
                  <div className="space-y-3">
                    {order.timeline.map((event) => (
                      <div className="rounded-md border p-3" key={event.id}>
                        <Field label="Yaratilgan vaqti" value={event.createdAt} />
                        <Field label="Hodisa turi" value={adminLabel(event.eventType)} />
                        <Field label="Bajaruvchi turi" value={adminLabel(event.actorType)} />
                        <Field
                          label="Holat o'zgarishi"
                          value={
                            event.fromStatus || event.toStatus
                              ? `${valueOrDash(event.fromStatus)} -> ${valueOrDash(event.toStatus)}`
                              : null
                          }
                        />
                        <Field label="Xabar" value={event.message} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Buyurtma tarixi yozuvlari yo'q.</p>
                )}
              </Section>
            </div>
          ) : (
            <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
              Buyurtma tafsilotlari topilmadi.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
