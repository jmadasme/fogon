/* eslint-disable react-hooks/purity */
import { redirect } from "next/navigation";
import { Banknote, BarChart3, Receipt, TrendingUp } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCLP, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MerchantAnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/merchant/analytics");

  const merchant = await db.merchant.findUnique({
    where: { ownerId: session.id },
    include: { stores: { select: { id: true, name: true } } },
  });
  if (!merchant) redirect("/registro/local");

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const orders = await db.order.findMany({
    where: {
      store: { merchantId: merchant.id },
      createdAt: { gte: since },
      paymentStatus: "PAID",
      NOT: { status: { startsWith: "CANCELLED" } },
    },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const gmv = orders.reduce((sum, order) => sum + order.total, 0);
  const commission = orders.reduce((sum, order) => sum + order.commissionAmount, 0);
  const aov = orders.length ? gmv / orders.length : 0;

  const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const current = itemMap.get(item.nameSnapshot) ?? {
        name: item.nameSnapshot,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += item.unitPrice * item.quantity;
      itemMap.set(item.nameSnapshot, current);
    }
  }
  const topItems = [...itemMap.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const dayOrders = orders.filter(
      (order) => order.createdAt >= date && order.createdAt < next,
    );
    return {
      label: date.toLocaleDateString("es-CL", { weekday: "short" }),
      value: dayOrders.reduce((sum, order) => sum + order.total, 0),
      count: dayOrders.length,
    };
  });
  const maxDay = Math.max(...days.map((day) => day.value), 1);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Analítica
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Últimos 30 días
        </h1>
        <p className="mt-1 text-sm text-muted">
          {merchant.name} · {merchant.stores.length} sucursales · datos de pedidos pagados.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="GMV" value={formatCLP(gmv)} hint="Ventas brutas" icon={Banknote} tone="success" />
        <StatCard label="Pedidos" value={formatNumber(orders.length)} hint="Pagados" icon={Receipt} tone="primary" />
        <StatCard label="Ticket promedio" value={formatCLP(aov)} hint="Por pedido" icon={TrendingUp} tone="info" />
        <StatCard label="Comisión" value={formatCLP(commission)} hint="Fogón" icon={BarChart3} tone="default" />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Aún no hay datos"
          description="Cuando tengas pedidos pagados, verás tus ventas, ticket promedio y platos más vendidos."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="card p-5">
            <h2 className="font-display text-base font-semibold">Ventas últimos 7 días</h2>
            <div className="mt-5 flex h-48 items-end gap-2">
              {days.map((day) => (
                <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                  <span className="font-mono-nums text-[9px] text-muted">
                    {day.value > 0 ? formatCLP(day.value) : "—"}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-primary/70 transition-all"
                      style={{ height: `${Math.max(3, (day.value / maxDay) * 100)}%` }}
                      title={`${day.count} pedidos`}
                    />
                  </div>
                  <span className="text-[10px] uppercase text-muted">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-display text-base font-semibold">Platos más vendidos</h2>
            <div className="mt-3 space-y-2.5">
              {topItems.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="font-mono-nums text-[10px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.name}</p>
                    <p className="text-[10px] text-muted">{item.quantity} vendidos</p>
                  </div>
                  <span className="font-mono-nums text-xs text-primary">{formatCLP(item.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
