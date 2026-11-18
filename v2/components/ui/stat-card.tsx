import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "success" | "danger" | "info";
  className?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
    info: "text-info",
  }[tone];

  return (
    <div className={cn("card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {label}
          </p>
          <p className={cn("mt-2 font-display text-2xl font-bold tracking-tight font-mono-nums", toneClass)}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        {Icon && (
          <div className="rounded-lg border border-border bg-surface-2 p-2 text-muted">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
