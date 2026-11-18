"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBox({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const comuna = searchParams.get("comuna") ?? "";

  return (
    <form action="/" method="get" className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Busca sushi, pizza, comida casera…"
          className="input h-10 pl-9 pr-20 text-sm"
          aria-label="Buscar comida"
          suppressHydrationWarning
        />
        {comuna && <input type="hidden" name="comuna" value={comuna} />}
        <button
          type="submit"
          className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-md bg-primary px-2.5 text-[11px] font-bold text-primary-ink"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
