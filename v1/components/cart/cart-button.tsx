"use client";

import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { cn } from "@/lib/utils";

export function CartButton({ className }: { className?: string }) {
  const { count, openCart, isReady } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      className={cn("btn btn-secondary relative gap-2", className)}
      aria-label="Abrir carrito"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Carrito</span>
      {isReady && count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-mono-nums text-[10px] font-bold text-primary-ink">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
