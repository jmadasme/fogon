"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Minus, Plus, X } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { formatCLP } from "@/lib/utils";

type Option = { id: string; name: string; priceDelta: number };
type Modifier = {
  id: string;
  name: string;
  type: string;
  required: boolean;
  min: number;
  max: number;
  options: Option[];
};
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  emoji: string | null;
  imageUrl: string | null;
  available: boolean;
  modifiers: Modifier[];
};
type Category = { id: string; name: string; items: Item[] };
type StoreInfo = {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  comuna: string;
  prepTimeMin: number;
  lat: number;
  lng: number;
  minOrder: number;
};

export function StoreMenu({
  store,
  categories,
}: {
  store: StoreInfo;
  categories: Category[];
}) {
  const cart = useCart();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedItem(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selectedModifiers = useMemo(() => {
    if (!selectedItem) return [];
    return selectedItem.modifiers.flatMap((modifier) => {
      const ids = selection[modifier.id] ?? [];
      return modifier.options
        .filter((option) => ids.includes(option.id))
        .map((option) => ({
          id: option.id,
          name: option.name,
          priceDelta: option.priceDelta,
        }));
    });
  }, [selectedItem, selection]);

  const selectedUnitPrice = selectedItem
    ? selectedItem.price +
      selectedModifiers.reduce((sum, modifier) => sum + modifier.priceDelta, 0)
    : 0;

  function openItem(item: Item) {
    if (!item.available) return;
    if (item.modifiers.length === 0) {
      addSimple(item);
      return;
    }
    const defaults: Record<string, string[]> = {};
    for (const modifier of item.modifiers) {
      if (modifier.required && modifier.min > 0) {
        defaults[modifier.id] = modifier.options
          .slice(0, Math.max(1, modifier.min))
          .map((option) => option.id);
      }
    }
    setSelectedItem(item);
    setSelection(defaults);
    setNotes("");
    setQuantity(1);
    setFormError(null);
  }

  function addSimple(item: Item) {
    if (!cart.isReady) return;
    const replacing = Boolean(cart.store && cart.store.id !== store.id);
    cart.addItem(store, item, 1, [], undefined);
    setToast(
      replacing
        ? "Reemplazamos tu carrito anterior. Agregado."
        : `${item.name} agregado al carrito.`,
    );
  }

  function toggleOption(modifier: Modifier, optionId: string) {
    setFormError(null);
    setSelection((current) => {
      const currentIds = current[modifier.id] ?? [];
      if (modifier.type === "SINGLE") {
        return { ...current, [modifier.id]: [optionId] };
      }
      if (currentIds.includes(optionId)) {
        return {
          ...current,
          [modifier.id]: currentIds.filter((id) => id !== optionId),
        };
      }
      if (currentIds.length >= modifier.max) {
        setFormError(`Puedes elegir hasta ${modifier.max} opciones en ${modifier.name}.`);
        return current;
      }
      return { ...current, [modifier.id]: [...currentIds, optionId] };
    });
  }

  function validateSelection(item: Item) {
    for (const modifier of item.modifiers) {
      const count = (selection[modifier.id] ?? []).length;
      if (count < modifier.min) {
        return `Elige al menos ${modifier.min} opción(es) en ${modifier.name}.`;
      }
      if (count > modifier.max) {
        return `Elige como máximo ${modifier.max} opción(es) en ${modifier.name}.`;
      }
    }
    return null;
  }

  function addSelected() {
    if (!selectedItem) return;
    const error = validateSelection(selectedItem);
    if (error) {
      setFormError(error);
      return;
    }
    if (!cart.isReady) {
      setFormError("El carrito está cargando. Intenta de nuevo.");
      return;
    }
    const replacing = Boolean(cart.store && cart.store.id !== store.id);
    cart.addItem(
      store,
      selectedItem,
      quantity,
      selectedModifiers,
      notes.trim() || undefined,
    );
    setToast(
      replacing
        ? "Reemplazamos tu carrito anterior. Agregado."
        : `${quantity} × ${selectedItem.name} agregado.`,
    );
    setSelectedItem(null);
  }

  function scrollToCategory(id: string) {
    setActiveCategory(id);
    document.getElementById(`category-${id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div>
      <div className="sticky top-[6.5rem] z-20 -mx-4 mb-5 border-y border-border bg-bg/90 px-4 py-2 backdrop-blur lg:top-20">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => scrollToCategory(category.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === category.id
                  ? "bg-primary text-primary-ink"
                  : "border border-border bg-surface-2 text-muted hover:text-foreground"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {categories.map((category) => (
          <section
            key={category.id}
            id={`category-${category.id}`}
            className="scroll-mt-36"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold tracking-tight">
                {category.name}
              </h2>
              <span className="text-[11px] text-muted">
                {category.items.length} {category.items.length === 1 ? "plato" : "platos"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {category.items.map((item) => (
                <article
                  key={item.id}
                  className={`group flex gap-3 rounded-xl border border-border bg-surface/60 p-3 transition hover:border-primary/25 ${
                    !item.available ? "opacity-60" : ""
                  }`}
                >
                  <div
                    className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-3 bg-cover bg-center text-3xl"
                    style={
                      item.imageUrl
                        ? { backgroundImage: `url(${item.imageUrl})` }
                        : undefined
                    }
                  >
                    {!item.imageUrl && <span>{item.emoji ?? "🍽️"}</span>}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-snug">{item.name}</h3>
                      {item.modifiers.length > 0 && (
                        <span className="badge badge-muted shrink-0 text-[9px]">
                          Personalizable
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="font-mono-nums text-sm font-bold text-foreground">
                        {formatCLP(item.price)}
                      </span>
                      <button
                        type="button"
                        disabled={!item.available}
                        onClick={() => openItem(item)}
                        className={`btn btn-sm ${
                          item.available ? "btn-secondary" : "btn-ghost"
                        }`}
                      >
                        {item.available ? (
                          <>
                            Agregar
                            <Plus className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          "Agotado"
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedItem(null)}
            aria-label="Cerrar"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-dialog-title"
            className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 id="item-dialog-title" className="font-display text-lg font-bold">
                  {selectedItem.name}
                </h2>
                {selectedItem.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {selectedItem.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="btn btn-ghost h-8 w-8 shrink-0 p-0"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
              <div className="space-y-5">
                {selectedItem.modifiers.map((modifier) => (
                  <fieldset key={modifier.id}>
                    <legend className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{modifier.name}</span>
                      <span className="text-[10px] text-muted">
                        {modifier.required ? "Obligatorio" : "Opcional"}
                        {modifier.max > 1 ? ` · hasta ${modifier.max}` : ""}
                      </span>
                    </legend>
                    <div className="mt-2 space-y-1.5">
                      {modifier.options.map((option) => {
                        const checked = (selection[modifier.id] ?? []).includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                              checked
                                ? "border-primary/40 bg-primary/10"
                                : "border-border bg-surface-2/60 hover:border-surface-3"
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                className={`flex h-4 w-4 items-center justify-center border ${
                                  modifier.type === "SINGLE" ? "rounded-full" : "rounded"
                                } ${
                                  checked
                                    ? "border-primary bg-primary text-primary-ink"
                                    : "border-muted/50"
                                }`}
                              >
                                {checked && <Check className="h-3 w-3" />}
                              </span>
                              <span>{option.name}</span>
                            </span>
                            <span className="font-mono-nums text-xs text-muted">
                              {option.priceDelta > 0
                                ? `+${formatCLP(option.priceDelta)}`
                                : "Incluido"}
                            </span>
                            <input
                              type={modifier.type === "SINGLE" ? "radio" : "checkbox"}
                              name={modifier.id}
                              checked={checked}
                              onChange={() => toggleOption(modifier, option.id)}
                              className="sr-only"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}

                <div>
                  <label htmlFor="item-notes" className="label">
                    Notas para la cocina
                  </label>
                  <textarea
                    id="item-notes"
                    className="textarea min-h-20"
                    placeholder="Sin cebolla, salsa aparte, término medio…"
                    maxLength={240}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <footer className="border-t border-border bg-surface px-5 py-4">
              {formError && (
                <p className="mb-2 text-xs font-medium text-danger">{formError}</p>
              )}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-foreground"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    aria-label="Menos"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-mono-nums text-sm">{quantity}</span>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-foreground"
                    onClick={() => setQuantity((value) => Math.min(20, value + 1))}
                    aria-label="Más"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addSelected}
                  className="btn btn-primary flex-1 justify-between"
                >
                  <span>Agregar al carrito</span>
                  <span className="font-mono-nums">{formatCLP(selectedUnitPrice * quantity)}</span>
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-2xl animate-fade-in">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-4 w-4" />
          </span>
          <p className="max-w-[16rem] text-xs text-foreground">{toast}</p>
          <button
            type="button"
            onClick={() => {
              setToast(null);
              cart.openCart();
            }}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Ver carrito
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
