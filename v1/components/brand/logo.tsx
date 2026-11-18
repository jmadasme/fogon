import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#F0B90B" />
      <path
        d="M16.1 4.5c.8 4.1 4.9 6.3 4.9 11.4a5 5 0 0 1-10 0c0-2.5 1.3-4.4 2.8-6.3.2 1.8 1 3 2 3.8-.3-2.9 0-5.7.3-8.9Z"
        fill="#0B0E11"
      />
      <path
        d="M16 19.8c1.8 0 3.2-1.4 3.2-3.2 0-1.6-.8-2.8-1.7-4-.1 1.2-.6 2-1.2 2.5.1-1.7-.1-3.3-.3-4.9-1 2.2-3.2 4-3.2 6.4 0 1.8 1.4 3.2 3.2 3.2Z"
        fill="#F0B90B"
      />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display font-extrabold tracking-tight text-foreground",
            compact ? "text-lg" : "text-xl",
          )}
        >
          fogón
        </span>
        {!compact && (
          <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.22em] text-muted">
            comida local
          </span>
        )}
      </span>
    </span>
  );
}
