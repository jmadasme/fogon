"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Star,
  Store,
  XCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { OrderTimeline } from "@/components/ui/order-timeline";
import { formatCLP, parseJson, timeAgo } from "@/lib/utils";
import { isTrustedPaymentRedirectUrl } from "@/lib/urls";
import type { SerializedOrder } from "@/lib/orders/types";

const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-xl border border-border bg-surface-2 text-xs text-muted">
      Cargando mapa…
    </div>
  ),
});

type ModifierSnapshot = { id: string; name: string; priceDelta: number };

export function OrderTrackingClient({
  initialOrder,
}: {
  initialOrder: SerializedOrder;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(initialOrder.reviewed);

  useEffect(() => {
    let active = true;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as SerializedOrder;
        if (active) {
          setOrder(data);
          setReviewed(data.reviewed);
        }
      } catch {
        // El polling se reintenta solo.
      }
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [order.id]);

  const markers = useMemo(() => {
    const list: {
      lat: number;
      lng: number;
      label: string;
      type: "store" | "customer" | "courier";
    }[] = [
      {
        lat: order.store.lat,
        lng: order.store.lng,
        label: order.store.name,
        type: "store",
      },
    ];
    if (order.deliveryMode === "DELIVERY") {
      list.push({
        lat: order.lat,
        lng: order.lng,
        label: "Tu dirección",
        type: "customer",
      });
    }
    if (order.courier?.currentLat != null && order.courier.currentLng != null) {
      list.push({
        lat: order.courier.currentLat,
        lng: order.courier.currentLng,
        label: `${order.courier.name} · repartidor`,
        type: "courier",
      });
    }
    return list;
  }, [order]);

  const center = useMemo(() => {
    const points = markers;
    if (points.length === 0) return undefined;
    return {
      lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
      lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
    };
  }, [markers]);

  async function cancelOrder() {
    if (!window.confirm("¿Cancelar este pedido? Esta acción no se puede deshacer.")) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED_BY_CUSTOMER",
          reason: "Cancelado por el cliente",
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "No pudimos cancelar el pedido.");
      } else {
        setMessage("Pedido cancelado.");
        const refresh = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (refresh.ok) setOrder((await refresh.json()) as SerializedOrder);
      }
    } finally {
      setBusy(false);
    }
  }

  async function retryPayment() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          provider: order.paymentProvider ?? "MERCADOPAGO",
        }),
      });
      const data = (await response.json()) as {
        redirectUrl?: string;
        error?: string;
      };
      if (!response.ok) {
        setMessage(data.error ?? "No pudimos iniciar el pago.");
        return;
      }
      if (
        data.redirectUrl &&
        isTrustedPaymentRedirectUrl(
          data.redirectUrl,
          order.paymentProvider ?? undefined,
        )
      ) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (data.redirectUrl) {
        console.error("URL de pago no confiable:", data.redirectUrl);
        setMessage("No pudimos redirigirte a la pasarela de pago.");
        return;
      }
      const refresh = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
      if (refresh.ok) setOrder((await refresh.json()) as SerializedOrder);
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "No pudimos guardar tu calificación.");
        return;
      }
      setReviewed(true);
      setMessage("¡Gracias por calificar!");
    } finally {
      setBusy(false);
    }
  }

  const flowPending =
    order.paymentProvider === "FLOW" &&
    order.paymentStatus === "PENDING" &&
    order.status === "PENDING_PAYMENT";
  const needsPayment =
    ["PENDING_PAYMENT", "FAILED"].includes(order.paymentStatus) || flowPending;
  const cashPending =
    order.paymentProvider === "CASH" && order.paymentStatus === "PENDING";
  const cancelled =
    order.status.startsWith("CANCELLED") ||
    ["REFUNDED", "EXPIRED"].includes(order.status);
  const delivered = ["DELIVERED", "COMPLETED"].includes(order.status);
  const title = cancelled
    ? "Pedido no completado"
    : delivered
      ? "¡Buen provecho!"
      : "Tu pedido está en marcha";
  const pin = order.deliveryPin;
  const showPin =
    pin &&
    !cancelled &&
    ["COURIER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(order.status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/orders" className="btn btn-ghost gap-2">
          <ArrowLeft className="h-4 w-4" />
          Mis pedidos
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono-nums text-xs text-muted">{order.code}</span>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Seguimiento en vivo
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {order.store.name} · {order.store.comuna} · Creado {timeAgo(order.createdAt)}
          </p>
        </div>
        {order.status !== "DELIVERED" && order.status !== "COMPLETED" && (
          <span className="badge badge-muted">
            <RefreshCw className="h-3 w-3" />
            Actualización automática
          </span>
        )}
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      )}

      {needsPayment && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-primary">
                {order.paymentStatus === "FAILED"
                  ? "El pago no se completó"
                  : "Pago pendiente"}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Completa el pago para que el local empiece a preparar tu pedido.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={retryPayment}
            disabled={busy}
            className="btn btn-primary shrink-0"
          >
            Pagar ahora
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-display text-base font-semibold">Estado</h2>
              <div className="mt-4">
                <OrderTimeline status={order.status} events={order.events} />
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-display text-base font-semibold">Mapa</h2>
                {order.deliveryMode === "DELIVERY" && (
                  <span className="badge badge-muted">{order.comuna}</span>
                )}
              </div>
              <MapView markers={markers} center={center} className="h-[19rem] w-full" />
            </div>
          </div>

          {showPin && pin && (
            <div className="card border-primary/30 bg-primary/5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    PIN de entrega
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Dale este código al repartidor cuando tengas tu pedido en la mano.
                  </p>
                </div>
                <div className="flex gap-2" data-testid="delivery-pin">
                  {pin.split("").map((digit, index) => (
                    <span
                      key={`${digit}-${index}`}
                      data-testid="delivery-pin-digit"
                      className="flex h-12 w-10 items-center justify-center rounded-lg border border-primary/30 bg-bg font-mono-nums text-xl font-bold text-primary"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {order.courier && (
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Bike className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{order.courier.name}</p>
                  <p className="text-[11px] text-muted">
                    {vehicleLabel(order.courier.vehicle)} · {order.courier.rating.toFixed(1)} ★
                  </p>
                </div>
                {order.courier.phone && (
                  <a href={`tel:${order.courier.phone}`} className="btn btn-secondary btn-sm">
                    <Phone className="h-3.5 w-3.5" />
                    Llamar
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h2 className="font-display text-base font-semibold">Tu pedido</h2>
            <div className="mt-3 space-y-3">
              {order.items.map((item) => {
                const modifiers = parseJson<ModifierSnapshot[]>(
                  item.modifiersJson,
                  [],
                );
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {item.quantity} × {item.name}
                      </p>
                      {modifiers.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted">
                          {modifiers.map((modifier) => modifier.name).join(" · ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-0.5 text-[11px] italic text-muted">
                          “{item.notes}”
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono-nums text-sm">
                      {formatCLP(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="my-4 divider" />
            <dl className="space-y-1.5 text-xs">
              <Row label="Subtotal" value={formatCLP(order.subtotal ?? 0)} />
              {order.deliveryMode === "DELIVERY" && (
                <Row
                  label={`Envío (${order.distanceKm} km)`}
                  value={formatCLP(order.deliveryFee ?? 0)}
                />
              )}
              {order.deliveryMode === "DELIVERY" && (
                <Row label="Servicio" value={formatCLP(order.serviceFee ?? 0)} />
              )}
              <Row label="Propina" value={formatCLP(order.tip)} />
              <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <dt>Total</dt>
                <dd className="font-mono-nums text-primary">{formatCLP(order.total)}</dd>
              </div>
            </dl>
          </div>

          {order.canReview && !reviewed && (
            <div className="card p-5">
              <h2 className="font-display text-base font-semibold">¿Cómo estuvo?</h2>
              <p className="mt-1 text-xs text-muted">
                Tu calificación ayuda a que la cocina local siga mejorando.
              </p>
              <div className="mt-3 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    aria-label={`${value} estrellas`}
                    className="rounded-md p-1 transition hover:bg-surface-2"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        value <= rating
                          ? "fill-primary text-primary"
                          : "text-surface-3"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <textarea
                className="textarea mt-3 min-h-20"
                placeholder="Cuéntanos qué tal estuvo la comida y la entrega…"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={500}
              />
              <button
                type="button"
                onClick={submitReview}
                disabled={busy}
                className="btn btn-primary mt-3"
              >
                Enviar calificación
              </button>
            </div>
          )}

          {reviewed && (
            <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/5 p-4 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Ya calificaste este pedido. ¡Gracias!
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="font-display text-base font-semibold">
              {order.deliveryMode === "PICKUP" ? "Retiro" : "Entrega"}
            </h2>
            <div className="mt-3 flex items-start gap-2.5 text-sm">
              {order.deliveryMode === "PICKUP" ? (
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              )}
              <div>
                <p className="font-medium">
                  {order.deliveryMode === "PICKUP" ? order.store.name : order.addressLine}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {order.deliveryMode === "PICKUP"
                    ? `${order.store.address}, ${order.store.comuna}`
                    : order.comuna}
                </p>
                {order.instructions && (
                  <p className="mt-1 text-[11px] italic text-muted">
                    “{order.instructions}”
                  </p>
                )}
              </div>
            </div>
            {order.deliveryMode === "DELIVERY" && !cancelled && (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                <Clock className="h-3.5 w-3.5" />
                Llega aproximadamente en {order.store.prepTimeMin + 15}–{order.store.prepTimeMin + 25} min
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-display text-base font-semibold">Pago</h2>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">{providerLabel(order.paymentProvider)}</span>
              <StatusBadge status={order.paymentStatus} kind="payment" />
            </div>
            <p className="mt-2 text-[11px] text-muted">
              {order.paymentStatus === "PAID"
                ? "Pago confirmado. El local ya recibió el aviso."
                : order.paymentStatus === "CANCELLED"
                  ? "No se realizó ningún cobro por este pedido."
                  : order.paymentStatus === "REFUND_PENDING"
                    ? "Reembolso pendiente. El equipo de Fogón lo procesará."
                    : cashPending
                    ? "Pago en efectivo al recibir. El repartidor cobrará al entregar."
                    : flowPending
                      ? "Pago online pendiente. Si ya pagaste, se confirmará en unos segundos."
                      : "El pedido se procesará cuando se confirme el pago."}
            </p>
          </div>

          <div className="card p-5">
            <h2 className="font-display text-base font-semibold">Local</h2>
            <p className="mt-2 text-sm font-medium">{order.store.name}</p>
            <p className="mt-0.5 text-xs text-muted">
              {order.store.cuisine} · {order.store.comuna}
            </p>
            <Link
              href={`/store/${order.store.slug}`}
              className="btn btn-secondary btn-sm mt-3 w-full"
            >
              Ver menú
            </Link>
          </div>

          {order.canCancel && (
            <button
              type="button"
              onClick={cancelOrder}
              disabled={busy}
              className="btn btn-danger w-full"
            >
              <XCircle className="h-4 w-4" />
              Cancelar pedido
            </button>
          )}

          <div className="card-soft p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Package className="h-3.5 w-3.5 text-primary" />
              ¿Problemas con tu pedido?
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Escríbenos a soporte@fogon.cl con tu código {order.code}. Respondemos
              en menos de 24 horas.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono-nums">{value}</dd>
    </div>
  );
}

function vehicleLabel(vehicle: string) {
  const labels: Record<string, string> = {
    BIKE: "Bicicleta",
    MOTORCYCLE: "Moto",
    CAR: "Auto",
    WALKING: "A pie",
  };
  return labels[vehicle] ?? vehicle;
}

function providerLabel(provider: string | null) {
  const labels: Record<string, string> = {
    MERCADOPAGO: "Mercado Pago",
    TRANSBANK: "Webpay / Transbank",
    FLOW: "Flow (Webpay / MACH)",
    CASH: "Efectivo al recibir",
    MOCK: "Pago demo",
  };
  return provider ? labels[provider] ?? provider : "Sin pago";
}
