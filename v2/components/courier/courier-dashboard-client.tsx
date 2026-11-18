"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Bike,
  Check,
  Clock,
  MapPin,
  Navigation,
  Package,
  Phone,
  Power,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { formatCLP, timeAgo } from "@/lib/utils";
import type { CourierDashboard, CourierOrder } from "@/lib/courier/types";

const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 w-full items-center justify-center rounded-xl border border-border bg-surface-2 text-xs text-muted">
      Cargando mapa…
    </div>
  ),
});

export function CourierDashboardClient({
  initial,
}: {
  initial: CourierDashboard;
}) {
  const [dashboard, setDashboard] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinOrder, setPinOrder] = useState<CourierOrder | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const lastLocation = useRef(0);

  const verified = dashboard.courier.verificationStatus === "VERIFIED";

  async function refresh() {
    try {
      const response = await fetch("/api/courier", { cache: "no-store" });
      if (!response.ok) return;
      setDashboard((await response.json()) as CourierDashboard);
    } catch {
      // reintenta en el próximo ciclo
    }
  }

  useEffect(() => {
    const interval = window.setInterval(refresh, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!verified || dashboard.courier.status !== "AVAILABLE") return;
    if (!navigator.geolocation) return;

    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastLocation.current < 30000) return;
        lastLocation.current = now;
        fetch("/api/courier/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watch);
  }, [verified, dashboard.courier.status]);

  async function toggleStatus() {
    if (!verified) {
      setError("Tu cuenta aún está en revisión. Te avisaremos cuando esté activa.");
      return;
    }
    const next =
      dashboard.courier.status === "OFFLINE" ? "AVAILABLE" : "OFFLINE";
    setBusy("status");
    setError(null);
    try {
      const response = await fetch("/api/courier/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "No pudimos cambiar tu estado.");
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function updateStatus(
    order: { id: string },
    status: string,
    deliveryPin?: string,
  ) {
    setBusy(order.id);
    setError(null);
    setPinError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, pin: deliveryPin }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        if (deliveryPin) setPinError(data.error ?? "No pudimos confirmar la entrega.");
        else setError(data.error ?? "No pudimos actualizar el pedido.");
        return;
      }
      setPinOrder(null);
      setPin("");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  function openPin(order: CourierOrder) {
    setPin("");
    setPinError(null);
    setPinOrder(order);
  }

  const active = dashboard.active;
  const markers = useMemo(() => {
    if (!active) return [];
    const list: {
      lat: number;
      lng: number;
      label: string;
      type: "store" | "customer" | "courier";
    }[] = [
      {
        lat: active.store.lat,
        lng: active.store.lng,
        label: active.store.name,
        type: "store",
      },
      {
        lat: active.lat,
        lng: active.lng,
        label: active.customer.name,
        type: "customer",
      },
    ];
    if (dashboard.courier.currentLat != null && dashboard.courier.currentLng != null) {
      list.push({
        lat: dashboard.courier.currentLat,
        lng: dashboard.courier.currentLng,
        label: "Tu ubicación",
        type: "courier",
      });
    }
    return list;
  }, [active, dashboard.courier.currentLat, dashboard.courier.currentLng]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Panel repartidor
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            Hola, {dashboard.courier.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {dashboard.courier.zone ? `Zona ${dashboard.courier.zone} · ` : ""}
            {dashboard.courier.rating.toFixed(1)} ★ · {vehicleLabel(dashboard.courier.vehicle)}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleStatus}
          disabled={busy === "status" || dashboard.courier.status === "BUSY"}
          className={`btn btn-lg min-w-48 ${
            dashboard.courier.status === "AVAILABLE"
              ? "btn-success"
              : "btn-primary"
          }`}
        >
          <Power className="h-4 w-4" />
          {dashboard.courier.status === "AVAILABLE"
            ? "Conectado · Desconectarme"
            : dashboard.courier.status === "BUSY"
              ? "Entrega en curso"
              : "Conectarme"}
        </button>
      </div>

      {!verified && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">Cuenta en revisión</p>
            <p className="mt-0.5 text-xs text-muted">
              Estamos verificando tus datos. Podrás conectarte y aceptar pedidos
              cuando tu cuenta esté activa.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Ganancias hoy"
          value={formatCLP(dashboard.earnings.today)}
          hint={`${dashboard.earnings.deliveriesToday} ${dashboard.earnings.deliveriesToday === 1 ? "entrega" : "entregas"}`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Ganancias semana"
          value={formatCLP(dashboard.earnings.week)}
          hint={`${dashboard.earnings.deliveriesWeek} ${dashboard.earnings.deliveriesWeek === 1 ? "entrega" : "entregas"}`}
          icon={Bike}
          tone="primary"
        />
        <StatCard
          label="Rating"
          value={`${dashboard.courier.rating.toFixed(1)} ★`}
          hint={`${dashboard.courier.ratingCount} calificaciones`}
          icon={ShieldCheck}
          tone="info"
        />
      </div>

      {active ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="font-mono-nums text-[10px] text-muted">{active.code}</p>
                  <h2 className="font-display text-lg font-bold">Entrega activa</h2>
                </div>
                <StatusBadge status={active.status} />
              </div>
              <MapView markers={markers} className="h-64 w-full" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Retiro
                </p>
                <p className="mt-1 text-sm font-semibold">{active.store.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {active.store.address}, {active.store.comuna}
                </p>
                <p className="mt-1 text-[11px] text-primary">
                  {active.distanceToStore} km desde tu ubicación
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Entrega
                </p>
                <p className="mt-1 text-sm font-semibold">{active.customer.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {active.addressLine}, {active.comuna}
                </p>
                {active.instructions && (
                  <p className="mt-1 text-[11px] italic text-muted">
                    “{active.instructions}”
                  </p>
                )}
                {active.customer.phone && (
                  <a
                    href={`tel:${active.customer.phone}`}
                    className="btn btn-secondary btn-sm mt-2 gap-1.5"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Llamar
                  </a>
                )}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="font-display text-sm font-semibold">Pedido</h3>
              <div className="mt-2 space-y-2">
                {active.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2 text-xs">
                    <span>
                      <span className="font-mono-nums text-primary">{item.quantity}×</span>{" "}
                      {item.name}
                    </span>
                    <span className="font-mono-nums text-muted">
                      {formatCLP(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Tu pago por esta entrega
              </p>
              <p className="mt-1 font-mono-nums text-2xl font-bold text-primary">
                {formatCLP(active.courierPayout)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Incluye base + distancia. La propina se suma al finalizar.
              </p>
            </div>

            {active.status === "COURIER_ASSIGNED" && (
              <button
                type="button"
                onClick={() => updateStatus(active, "PICKED_UP")}
                disabled={busy === active.id}
                className="btn btn-primary btn-lg w-full"
              >
                <Package className="h-4 w-4" />
                Confirmar retiro en local
              </button>
            )}

            {active.status === "PICKED_UP" && (
              <button
                type="button"
                onClick={() => openPin(active)}
                disabled={busy === active.id}
                className="btn btn-success btn-lg w-full"
              >
                <Check className="h-4 w-4" />
                Confirmar entrega
              </button>
            )}

            <div className="card-soft p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Navigation className="h-3.5 w-3.5 text-primary" />
                Navegación
              </p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${active.lat},${active.lng}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm mt-2 w-full"
              >
                Abrir ruta al cliente
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </aside>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">
                Pedidos disponibles
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Cerca de tu zona · primero en aceptar
              </p>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="btn btn-secondary btn-sm gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualizar
            </button>
          </div>

          {dashboard.available.length === 0 ? (
            <EmptyState
              icon={Bike}
              title={
                dashboard.courier.status === "OFFLINE"
                  ? "Conéctate para recibir pedidos"
                  : "Esperando pedidos"
              }
              description={
                dashboard.courier.status === "OFFLINE"
                  ? "Pulsa “Conectarme” y te avisaremos cuando haya una entrega cerca."
                  : "No hay pedidos disponibles en este momento. Te avisaremos en cuanto aparezca uno."
              }
              action={
                dashboard.courier.status === "OFFLINE" && verified ? (
                  <button type="button" onClick={toggleStatus} className="btn btn-primary">
                    <Power className="h-4 w-4" />
                    Conectarme
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dashboard.available.map((order, index) => (
                <article key={order.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono-nums text-[10px] text-muted">{order.code}</p>
                      <h3 className="mt-0.5 text-sm font-semibold">{order.store.name}</h3>
                      <p className="text-[11px] text-muted">
                        {order.store.comuna} · {order.comuna}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="badge badge-primary">
                        {formatCLP(order.courierPayout)}
                      </span>
                      {index === 0 && (
                        <span className="badge badge-success text-[9px]">Más cercano</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                    <span
                      data-testid="courier-distance"
                      className="flex items-center gap-1 text-primary"
                    >
                      <MapPin className="h-3 w-3" />
                      {order.distanceToStore} km al local
                    </span>
                    <span className="flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      {order.distanceKm} km de entrega
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(order.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {order.itemCount} items
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateStatus(order, "COURIER_ASSIGNED")}
                    disabled={busy === order.id || !verified}
                    className="btn btn-primary mt-3 w-full"
                  >
                    Aceptar pedido
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {pinOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">

          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPinOrder(null)}
            aria-label="Cerrar"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">PIN de entrega</h2>
                <p className="mt-1 text-xs text-muted">
                  Pídele al cliente el código de 4 dígitos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPinOrder(null)}
                className="btn btn-ghost h-8 w-8 p-0"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              className="input mt-4 h-14 text-center font-mono-nums text-2xl tracking-[0.4em]"
              placeholder="••••"
              autoFocus
            />
            {pinError && <p className="mt-2 text-xs text-danger">{pinError}</p>}
            <button
              type="button"
              onClick={() => updateStatus(pinOrder, "DELIVERED", pin)}
              disabled={pin.length !== 4 || busy === pinOrder.id}
              className="btn btn-success btn-lg mt-4 w-full"
            >
              Confirmar entrega
            </button>
          </div>
        </div>
      )}
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
