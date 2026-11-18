import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function orderVariant(status: string) {
  if (["DELIVERED", "COMPLETED"].includes(status)) return "success";
  if (status.startsWith("CANCELLED") || ["REFUNDED", "EXPIRED"].includes(status)) return "danger";
  if (["PENDING_COURIER", "PENDING_MERCHANT", "PENDING_PAYMENT"].includes(status)) return "primary";
  if (["ACCEPTED", "PREPARING", "READY", "COURIER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(status)) return "info";
  return "muted";
}

function paymentVariant(status: string) {
  if (status === "PAID") return "success";
  if (["FAILED", "CANCELLED", "REFUNDED"].includes(status)) return "danger";
  if (["PENDING", "AUTHORIZED", "REFUND_PENDING"].includes(status)) return "primary";
  return "muted";
}

export function StatusBadge({
  status,
  kind = "order",
  className,
}: {
  status: string;
  kind?: "order" | "payment";
  className?: string;
}) {
  const variant =
    kind === "payment" ? paymentVariant(status) : orderVariant(status);
  const label =
    kind === "payment"
      ? PAYMENT_STATUS_LABELS[status] ?? status
      : ORDER_STATUS_LABELS[status] ?? status;

  return (
    <span className={cn(`badge badge-${variant}`, className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          variant === "success" && "bg-success",
          variant === "danger" && "bg-danger",
          variant === "primary" && "bg-primary",
          variant === "info" && "bg-info",
          variant === "muted" && "bg-muted",
        )}
      />
      {label}
    </span>
  );
}
