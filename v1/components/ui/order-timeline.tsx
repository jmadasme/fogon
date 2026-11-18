import { Check, Clock, XCircle } from "lucide-react";
import { TIMELINE_STEPS, isCancelled, timelineStep } from "@/lib/order-status";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";

type Event = {
  id: string;
  type: string;
  createdAt: string | Date;
};

export function OrderTimeline({
  status,
  events = [],
  compact = false,
}: {
  status: string;
  events?: Event[];
  compact?: boolean;
}) {
  const current = timelineStep(status);
  const cancelled = isCancelled(status);

  if (cancelled) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/5 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div>
          <p className="text-sm font-semibold text-danger">
            {ORDER_STATUS_LABELS[status] ?? status}
          </p>
          <p className="mt-1 text-xs text-muted">
            Este pedido no se completó. Si tienes dudas, contacta a soporte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", compact && "space-y-0")}>
      {TIMELINE_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const last = index === TIMELINE_STEPS.length - 1;
        return (
          <div key={step.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                  done && "border-success/40 bg-success/15 text-success",
                  active && "border-primary/50 bg-primary/15 text-primary",
                  !done && !active && "border-border bg-surface-2 text-muted",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : active ? <Clock className="h-3.5 w-3.5" /> : index + 1}
              </div>
              {!last && (
                <div
                  className={cn(
                    "my-1 w-px flex-1",
                    done ? "bg-success/30" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className={cn("pb-5", last && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-semibold",
                  active ? "text-foreground" : done ? "text-foreground/80" : "text-muted",
                )}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-xs text-muted">{step.description}</p>
              {active && (
                <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
                  En curso
                </span>
              )}
            </div>
          </div>
        );
      })}

      {events.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Historial
          </p>
          <div className="space-y-1.5">
            {events.slice(-6).map((event) => (
              <div key={event.id} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-muted">{eventLabel(event.type)}</span>
                <span className="font-mono-nums text-muted/70">
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    ORDER_CREATED: "Pedido creado",
    PAYMENT_CONFIRMED: "Pago confirmado",
    PAYMENT_CASH_PENDING: "Pago en efectivo al recibir",
    PAYMENT_FAILED: "Pago fallido",
    MERCHANT_ACCEPTED: "Local aceptó",
    MERCHANT_REJECTED: "Local rechazó",
    PREPARING: "En preparación",
    READY: "Pedido listo",
    PENDING_COURIER: "Repartidor solicitado",
    COURIER_REQUESTED: "Repartidor solicitado",
    COURIER_ASSIGNED: "Repartidor asignado",
    PICKED_UP: "Pedido retirado",
    OUT_FOR_DELIVERY: "Salió a entregar",
    DELIVERED: "Pedido entregado",
    CANCELLED: "Pedido cancelado",
    REFUNDED: "Pedido reembolsado",
    REVIEWED: "Pedido calificado",
    EXPIRED: "Pedido expirado",
  };
  return labels[type] ?? type;
}
