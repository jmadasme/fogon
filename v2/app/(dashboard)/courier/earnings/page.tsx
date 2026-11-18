/* eslint-disable react-hooks/purity */
import { redirect } from "next/navigation";
import { Banknote, Bike, Receipt, Wallet } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCLP, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CourierEarningsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/courier/earnings");

  const courier = await db.courier.findUnique({
    where: { userId: session.id },
    select: { id: true, verificationStatus: true },
  });
  if (!courier) redirect("/registro/repartidor");
  if (courier.verificationStatus !== "VERIFIED") {
    redirect("/kyc?status=required");
  }

  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
  const orders = await db.order.findMany({
    where: {
      courierId: courier.id,
      status: "DELIVERED",
      deliveredAt: { gte: since },
    },
    include: { store: { select: { name: true, emoji: true, comuna: true } } },
    orderBy: { deliveredAt: "desc" },
  });

  const total = orders.reduce((sum, order) => sum + order.courierPayout + order.tip, 0);
  const base = orders.reduce((sum, order) => sum + order.courierPayout, 0);
  const tips = orders.reduce((sum, order) => sum + order.tip, 0);
  const avg = orders.length ? total / orders.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Ganancias
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Últimos 30 días
        </h1>
        <p className="mt-1 text-sm text-muted">
          Detalle de tus entregas, pagos base y propinas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={formatCLP(total)} hint={`${orders.length} entregas`} icon={Wallet} tone="success" />
        <StatCard label="Pago base" value={formatCLP(base)} hint="Base + distancia" icon={Bike} tone="primary" />
        <StatCard label="Propinas" value={formatCLP(tips)} hint="100% para ti" icon={Banknote} tone="info" />
        <StatCard label="Promedio" value={formatCLP(avg)} hint="Por entrega" icon={Receipt} tone="default" />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Aún no tienes entregas"
          description="Cuando completes tu primera entrega, aquí verás el detalle de tus ganancias."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Local</th>
                  <th>Fecha</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">Propina</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono-nums text-xs">{order.code}</td>
                    <td>
                      <span className="flex items-center gap-2 text-xs">
                        <span>{order.store.emoji}</span>
                        <span>{order.store.name}</span>
                      </span>
                    </td>
                    <td className="text-xs text-muted">
                      {order.deliveredAt ? formatDateTime(order.deliveredAt) : "—"}
                    </td>
                    <td className="text-right font-mono-nums text-xs">
                      {formatCLP(order.courierPayout)}
                    </td>
                    <td className="text-right font-mono-nums text-xs text-success">
                      {formatCLP(order.tip)}
                    </td>
                    <td className="text-right font-mono-nums text-xs font-semibold">
                      {formatCLP(order.courierPayout + order.tip)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
