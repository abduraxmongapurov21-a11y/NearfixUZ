"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import { StatCard } from "@/shared/components/stat-card";
import { useDashboardSummary } from "../hooks/use-dashboard-summary";

export function DashboardOverview() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="h-32 rounded-lg border bg-card" key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-5">
        <StatCard helper="Hozir jarayonda" label="Active orders" value={data.activeOrders} />
        <StatCard
          helper="Usta javobi kutilmoqda"
          label="Waiting response"
          tone="warning"
          value={data.waitingResponse}
        />
        <StatCard helper="Faol buyurtmada" label="Busy workers" value={data.busyWorkers} />
        <StatCard
          helper="Bugun yakunlangan"
          label="Completed today"
          tone="success"
          value={data.completedToday}
        />
        <StatCard
          helper="Bugungi bekorlar"
          label="Cancelled today"
          tone="danger"
          value={data.cancelledToday}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>City overview</CardTitle>
        </CardHeader>
        <CardContent>
          {data.cityOverview.length ? (
            <div className="divide-y">
              {data.cityOverview.map((city) => (
                <div className="grid grid-cols-3 py-3 text-sm" key={city.city}>
                  <div className="font-medium">{city.city}</div>
                  <div className="text-muted-foreground">
                    {city.activeOrders} active orders
                  </div>
                  <div className="text-muted-foreground">
                    {city.availableWorkers} available workers
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Shahar kesimidagi operatsion holat backend ulanganda ko'rinadi."
              title="City data tayyor emas"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
