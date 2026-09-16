"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import { StatCard } from "@/shared/components/stat-card";
import { adminLabel } from "@/lib/admin-labels";
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
        <StatCard helper="Hozir jarayonda" label="Faol buyurtmalar" value={data.activeOrders} />
        <StatCard
          helper="Usta javobi kutilmoqda"
          label="Javob kutilmoqda"
          tone="warning"
          value={data.waitingResponse}
        />
        <StatCard helper="Faol buyurtmada" label="Band ustalar" value={data.busyWorkers} />
        <StatCard
          helper="Bugun yakunlangan"
          label="Bugun bajarilgan"
          tone="success"
          value={data.completedToday}
        />
        <StatCard
          helper="Bugungi bekorlar"
          label="Bugun bekor qilingan"
          tone="danger"
          value={data.cancelledToday}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shaharlar bo'yicha holat</CardTitle>
        </CardHeader>
        <CardContent>
          {data.cityOverview.length ? (
            <div className="divide-y">
              {data.cityOverview.map((city) => (
                <div className="grid grid-cols-3 py-3 text-sm" key={city.city}>
                  <div className="font-medium">{adminLabel(city.city)}</div>
                  <div className="text-muted-foreground">
                    {city.activeOrders} ta faol buyurtma
                  </div>
                  <div className="text-muted-foreground">
                    {city.availableWorkers} ta bo'sh usta
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Shahar kesimidagi operatsion holat backend ulanganda ko'rinadi."
              title="Shahar ma'lumotlari tayyor emas"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
