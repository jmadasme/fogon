import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
import { formatCLP, formatDateTime } from "@/lib/utils";
import { adminCancelOrderAction } from "@/app/actions/admin";
import { ACTIVE_ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await getSession();
  const canManage = session?.role === "ADMIN";
  const params = await searchParams;
  const rawStatus = params.status;
  const rawQ = params.q;
  const status = (Array.isArray(rawStatus) ? rawStatus[0] : rawStatus) ?? "";
  const q = ((Array.isArray(rawQ) ? rawQ[0] : rawQ)?.trim() ?? "").slice(0, 80);

  const orders = await db.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { store: { name: { contains: q } } },
              { customer: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      store: { select: { name: true, emoji: true } },
      customer: { select: { name: true } },
      courier: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Operación
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            Pedidos
          </h1>
          <p className="mt-1 text-sm text-muted">
            {orders.length} pedidos · {status ? ORDER_STATUS_LABELS[status] ?? status : "Todos los estados"}
          </p>
        </div>
        <form action="/admin/orders" method="get" className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Código, local o cliente"
              className="input h-9 w-56 pl-8 text-xs"
            />
          </div>
          <select name="status" defaultValue={status} className="select h-9 w-44 text-xs">
            <option value="">Todos los estados</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm">Filtrar</button>
        </form>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No hay pedidos con esos filtros"
          description="Prueba con otro estado o limpia la búsqueda."
          action={<Link href="/admin/orders" className="btn btn-secondary">Ver todos</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Local</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Pago</th>
                  <th>Repartidor</th>
                  <th>Fecha</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/order/${order.id}`} className="font-mono-nums text-xs text-primary hover:underline">
                        {order.code}
                      </Link>
                    </td>
                    <td className="text-xs">
                      <span className="mr-1">{order.store.emoji}</span>
                      {order.store.name}
                    </td>
                    <td className="text-xs">{order.customer.name}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <StatusBadge status={order.paymentStatus} kind="payment" />
                      <p className="mt-0.5 text-[10px] text-muted">
                        {paymentProviderLabel(order.paymentProvider)}
                      </p>
                    </td>
                    <td className="text-xs text-muted">
                      {order.courier?.user.name ?? "—"}
                    </td>
                    <td className="text-xs text-muted">{formatDateTime(order.createdAt)}</td>
                    <td className="text-right font-mono-nums text-xs font-semibold">
                      {formatCLP(order.total)}
                    </td>
                    <td className="text-right">
                      {canManage ? (
                        <div className="flex justify-end gap-1">
                          {ACTIVE_ORDER_STATUSES.includes(order.status) && (
                            <form action={adminCancelOrderAction}>
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="action" value="cancel" />
                              <button type="submit" className="btn btn-ghost btn-sm text-[10px] text-danger">
                                Cancelar
                              </button>
                            </form>
                          )}
                          {["PAID", "REFUND_PENDING"].includes(order.paymentStatus) &&
                            order.paymentProvider !== "FLOW" && (
                              <form action={adminCancelOrderAction}>
                                <input type="hidden" name="orderId" value={order.id} />
                                <input type="hidden" name="action" value="refund" />
                                <button type="submit" className="btn btn-ghost btn-sm text-[10px] text-primary">
                                  Reembolsar
                                </button>
                              </form>
                            )}
                          {order.paymentProvider === "FLOW" &&
                            ["PAID", "REFUND_PENDING"].includes(order.paymentStatus) && (
                              <span className="text-[10px] text-muted">
                                Reembolso en Flow
                              </span>
                            )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted">Solo lectura</span>
                      )}
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

function paymentProviderLabel(provider: string | null) {
  const labels: Record<string, string> = {
    MERCADOPAGO: "Mercado Pago",
    TRANSBANK: "Transbank",
    FLOW: "Flow",
    CASH: "Efectivo",
    MOCK: "Demo",
  };
  return provider ? labels[provider] ?? provider : "Sin pago";
}
