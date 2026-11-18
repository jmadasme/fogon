"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { SANTIAGO_COMUNAS } from "@/lib/constants";

export function CommuneSelect({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("comuna") ?? "";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("comuna", value);
    else params.delete("comuna");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="relative flex items-center gap-1.5">
      <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-primary" />
      <span className="sr-only">Comuna</span>
      <select
        value={current}
        onChange={(event) => onChange(event.target.value)}
        className={
          compact
            ? "h-8 max-w-[9.5rem] appearance-none rounded-lg border border-border bg-surface-2 pl-7 pr-6 text-xs font-medium text-foreground outline-none hover:border-surface-3 focus:border-primary"
            : "h-9 max-w-[11rem] appearance-none rounded-lg border border-border bg-surface-2 pl-7 pr-7 text-xs font-medium text-foreground outline-none hover:border-surface-3 focus:border-primary"
        }
      >
        <option value="">Todo Santiago</option>
        {SANTIAGO_COMUNAS.map((comuna) => (
          <option key={comuna.name} value={comuna.name}>
            {comuna.name}
          </option>
        ))}
      </select>
    </label>
  );
}
