"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatCLP } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export function CartDrawer() {
  const {
    store,
    items,
    subtotal,
    count,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();
  const pathname = usePathname();

  useEffect(() => {
    closeCart();
  }, [pathname, closeCart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar carrito"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeCart}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl animate-fade-in">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
              Tu pedido
            </p>
            <h2 className="font-display text-lg font-bold">
              {store?.name ?? "Carrito"}
            </h2>
            {store && (
              <p className="mt-0.5 text-xs text-muted">
                {store.comuna} · {store.prepTimeMin} min aprox.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="btn btn-ghost h-9 w-9 p-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Tu carrito está vacío"
              description="Explora las cocinas de Santiago y agrega tu primer plato."
              action={
                <Link href="/" className="btn btn-primary" onClick={closeCart}>
                  Ver cocinas
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {items.map((line) => (
                <div
                  key={line.key}
                  className="rounded-xl border border-border bg-surface-2/60 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xl">
                      {line.emoji ?? "🍽️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{line.name}</p>
                      {line.modifiers.length > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted">
                          {line.modifiers.map((m) => m.name).join(" · ")}
                        </p>
                      )}
                      {line.notes && (
                        <p className="mt-0.5 text-[11px] text-muted italic">
                          “{line.notes}”
                        </p>
                      )}
                      <p className="mt-1 font-mono-nums text-sm text-primary">
                        {formatCLP(line.unitPrice * line.quantity)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(line.key)}
                      className="text-muted transition hover:text-danger"
                      aria-label={`Quitar ${line.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-foreground"
                        onClick={() => updateQuantity(line.key, line.quantity - 1)}
                        aria-label="Quitar uno"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center font-mono-nums text-sm">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-foreground"
                        onClick={() => updateQuantity(line.key, line.quantity + 1)}
                        aria-label="Agregar uno"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-xs text-muted">
                      {formatCLP(line.unitPrice)} c/u
                    </span>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={clearCart}
                className="mt-2 text-xs text-muted underline-offset-2 hover:text-danger hover:underline"
              >
                Vaciar carrito
              </button>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-border bg-surface px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted">
                Subtotal · {count} {count === 1 ? "producto" : "productos"}
              </span>
              <span className="font-mono-nums text-lg font-bold">
                {formatCLP(subtotal)}
              </span>
            </div>
            <p className="mb-3 text-[11px] text-muted">
              El envío y la tarifa de servicio se calculan en el checkout.
            </p>
            <Link
              href="/checkout"
              className="btn btn-primary btn-lg w-full"
              onClick={closeCart}
            >
              Ir a pagar
            </Link>
          </footer>
        )}
      </aside>
    </div>
  );
}
