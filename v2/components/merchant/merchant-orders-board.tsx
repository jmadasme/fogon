"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bike,
  Check,
  ChefHat,
  Clock,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Utensils,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCLP, parseJson, timeAgo } from "@/lib/utils";
import type { MerchantOrder } from "@/lib/merchant/types";

type ModifierSnapshot = { id: string; name: string; priceDelta: number };

const COLUMNS = [
  {
    key: "new",
    title: "Nuevos",
    statuses: ["PENDING_MERCHANT"],
    accent: "border-primary/30",
  },
  {
    key: "prep",
    title: "En preparación",
    statuses: ["ACCEPTED", "PREPARING"],
    accent: "border-info/30",
  },
  {
    key: "ready",
    title: "Listos",
    statuses: ["READY", "PENDING_COURIER"],
    accent: "border-primary/30",
  },
  {
    key: "way",
    title: "En camino",
    statuses: ["COURIER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"],
    accent: "border-success/30",
  },
] as const;

export function MerchantOrdersBoard({
  initialOrders,
  stores,
}: {
  initialOrders: MerchantOrder[];
  stores: { id: string; name: string; emoji: string }[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [storeFilter, setStoreFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [newOrderAlert, setNewOrderAlert] = useState<string | null>(null);
  const knownIds = useRef(new Set(initialOrders.map((order) => order.id)));

  async function refresh() {
    try {
      const response = await fetch("/api/merchant/orders", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { orders: MerchantOrder[] };
      const incomingNew = data.orders.filter(
        (order) =>
          order.status === "PENDING_MERCHANT" && !knownIds.current.has(order.id),
      );
      if (incomingNew.length > 0) {
        setNewOrderAlert(incomingNew[0].code);
        playBeep();
      }
      knownIds.current = new Set(data.orders.map((order) => order.id));
      setOrders(data.orders);
      setLastUpdate(new Date());
    } catch {
      // reintenta en el próximo ciclo
    }
  }

  useEffect(() => {
    const interval = window.setInterval(refresh, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!newOrderAlert) return;
    const timer = window.setTimeout(() => setNewOrderAlert(null), 8000);
    return () => window.clearTimeout(timer);
  }, [newOrderAlert]);

  const filtered = useMemo(
    () =>
      storeFilter === "all"
        ? orders
        : orders.filter((order) => order.store.id === storeFilter),
    [orders, storeFilter],
  );

  async function updateStatus(order: MerchantOrder, status: string) {
    setBusyId(order.id);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No pudimos actualizar el pedido.");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = filtered.filter((order) =>
    COLUMNS.some((column) => (column.statuses as readonly string[]).includes(order.status)),
  ).length;

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">
            Operación en vivo
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {activeCount} pedidos activos · actualizado {timeAgo(lastUpdate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stores.length > 1 && (
            <select
              value={storeFilter}
              onChange={(event) => setStoreFilter(event.target.value)}
              className="select h-9 max-w-52 text-xs"
              aria-label="Filtrar por local"
            >
              <option value="all">Todos los locales</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.emoji} {store.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={refresh}
            className="btn btn-secondary btn-sm gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {newOrderAlert && (
        <button
          type="button"
          onClick={() => setNewOrderAlert(null)}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-left text-sm text-primary animate-fade-in"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-ink">
            🔔
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Nuevo pedido {newOrderAlert}</span>
            <span className="block text-[11px] text-muted">
              Revísalo y acepta en los próximos 5 minutos.
            </span>
          </span>
          <span className="text-[11px] text-muted">Cerrar</span>
        </button>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {activeCount === 0 && orders.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="Todavía no hay pedidos"
          description="Cuando un cliente compre en tu local, el pedido aparecerá aquí en tiempo real."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {COLUMNS.map((column) => {
            const columnOrders = filtered.filter((order) =>
              (column.statuses as readonly string[]).includes(order.status),
            );
            return (
              <div
                key={column.key}
                className={`rounded-xl border ${column.accent} bg-surface/30`}
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
                    {column.title}
                  </h3>
                  <span className="badge badge-muted">{columnOrders.length}</span>
                </div>
                <div className="space-y-2.5 p-2.5">
                  {columnOrders.length === 0 && (
                    <p className="px-2 py-6 text-center text-[11px] text-muted">
                      Sin pedidos
                    </p>
                  )}
                  {columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      busy={busyId === order.id}
                      onUpdate={updateStatus}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function playBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.32);
    window.setTimeout(() => context.close().catch(() => {}), 600);
  } catch {
    // El navegador puede bloquear audio sin interacción; no bloquear la UI.
  }
}

function OrderCard({
  order,
  busy,
  onUpdate,
}: {
  order: MerchantOrder;
  busy: boolean;
  onUpdate: (order: MerchantOrder, status: string) => void;
}) {
  const isDelivery = order.deliveryMode === "DELIVERY";

  return (
    <article className="rounded-xl border border-border bg-surface p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono-nums text-[10px] font-semibold text-muted">{order.code}</p>
          <p className="mt-0.5 text-sm font-semibold">{order.customer.name}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted">
        <Clock className="h-3 w-3" />
        {timeAgo(order.createdAt)}
        <span className="text-border">·</span>
        {isDelivery ? "Delivery" : "Retiro"}
        {order.store && (
          <>
            <span className="text-border">·</span>
            <span className="truncate">{order.store.name}</span>
          </>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {order.items.map((item) => {
          const modifiers = parseJson<ModifierSnapshot[]>(item.modifiersJson, []);
          return (
            <div key={item.id} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="font-mono-nums text-primary">{item.quantity}×</span>{" "}
                  {item.name}
                </span>
                <span className="shrink-0 font-mono-nums text-muted">
                  {formatCLP(item.unitPrice * item.quantity)}
                </span>
              </div>
              {modifiers.length > 0 && (
                <p className="pl-5 text-[10px] text-muted">
                  {modifiers.map((modifier) => modifier.name).join(" · ")}
                </p>
              )}
              {item.notes && (
                <p className="pl-5 text-[10px] italic text-muted">“{item.notes}”</p>
              )}
            </div>
          );
        })}
      </div>

      {isDelivery && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-surface-2/60 px-2 py-2 text-[10px] text-muted">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          <span>
            {order.addressLine}, {order.comuna}
            {order.instructions && (
              <span className="block italic">“{order.instructions}”</span>
            )}
          </span>
        </div>
      )}

      {order.courier && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-success/5 px-2 py-1.5 text-[10px] text-success">
          <Bike className="h-3 w-3" />
          {order.courier.name} · {order.courier.phone ?? "sin teléfono"}
          {order.courier.phone && (
            <a href={`tel:${order.courier.phone}`} className="ml-auto text-primary">
              <Phone className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
        <span className="text-[10px] text-muted">
          {order.paymentStatus === "PAID" ? "Pagado" : "Pago pendiente"}
        </span>
        <span className="font-mono-nums text-sm font-bold">{formatCLP(order.total)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {order.status === "PENDING_MERCHANT" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate(order, "ACCEPTED")}
              className="btn btn-primary btn-sm flex-1"
            >
              <Check className="h-3.5 w-3.5" />
              Aceptar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate(order, "CANCELLED_BY_MERCHANT")}
              className="btn btn-danger btn-sm"
            >
              <X className="h-3.5 w-3.5" />
              Rechazar
            </button>
          </>
        )}

        {order.status === "ACCEPTED" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, "PREPARING")}
            className="btn btn-primary btn-sm w-full"
          >
            <ChefHat className="h-3.5 w-3.5" />
            Empezar preparación
          </button>
        )}

        {order.status === "PREPARING" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, "READY")}
            className="btn btn-success btn-sm w-full"
          >
            <PackageCheck className="h-3.5 w-3.5" />
            Marcar listo
          </button>
        )}

        {order.status === "READY" && order.deliveryMode === "PICKUP" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, "DELIVERED")}
            className="btn btn-success btn-sm w-full"
          >
            <Check className="h-3.5 w-3.5" />
            Cliente retiró
          </button>
        )}

        {order.status === "READY" && order.deliveryMode === "DELIVERY" && order.fulfillment === "OWN" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, "OUT_FOR_DELIVERY")}
            className="btn btn-primary btn-sm w-full"
          >
            <Bike className="h-3.5 w-3.5" />
            Salió a entregar
          </button>
        )}

        {order.status === "READY" && order.deliveryMode === "DELIVERY" && order.fulfillment !== "OWN" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, "PENDING_COURIER")}
            className="btn btn-primary btn-sm w-full"
          >
            <Bike className="h-3.5 w-3.5" />
            Solicitar repartidor
          </button>
        )}

        {order.status === "PENDING_COURIER" && (
          <>
            <span className="flex-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5 text-center text-[10px] font-medium text-primary">
              Buscando repartidor…
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onUpdate(order, "OUT_FOR_DELIVERY")}
              className="btn btn-secondary btn-sm"
            >
              Reparto propio
            </button>
          </>
        )}

        {order.status === "OUT_FOR_DELIVERY" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUpdate(order, "DELIVERED")}
            className="btn btn-success btn-sm w-full"
          >
            <Check className="h-3.5 w-3.5" />
            Marcar entregado
          </button>
        )}

        {order.status === "COURIER_ASSIGNED" && (
          <span className="w-full rounded-lg border border-info/20 bg-info/5 px-2 py-1.5 text-center text-[10px] font-medium text-info">
            Repartidor asignado
          </span>
        )}

        {order.status === "PICKED_UP" && (
          <span className="w-full rounded-lg border border-success/20 bg-success/5 px-2 py-1.5 text-center text-[10px] font-medium text-success">
            En camino al cliente
          </span>
        )}
      </div>
    </article>
  );
}
