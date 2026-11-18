"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Lock,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Store,
  Wallet,
  Zap,
} from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { EmptyState } from "@/components/ui/empty-state";
import {
  COMUNA_BY_NAME,
  SANTIAGO_COMUNAS,
  SERVICE_FEE_MAX,
  SERVICE_FEE_MIN,
} from "@/lib/constants";
import { calculateFees, distanceForComuna } from "@/lib/pricing";
import { formatCLP } from "@/lib/utils";
import { isTrustedPaymentRedirectUrl } from "@/lib/urls";

type SavedAddress = {
  id: string;
  label: string;
  line1: string;
  comuna: string;
  instructions: string | null;
  isDefault: boolean;
};

type PaymentProvider =
  | "MERCADOPAGO"
  | "TRANSBANK"
  | "FLOW_WEBPAY"
  | "FLOW_MACH";

export function CheckoutClient({
  user,
  addresses,
  paymentsMode,
  flowEnabled,
}: {
  user: { name: string; email: string; phone: string | null };
  addresses: SavedAddress[];
  paymentsMode: string;
  flowEnabled: boolean;
}) {
  const cart = useCart();
  const router = useRouter();
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];
  const requestIdRef = useRef<string | null>(null);

  const [deliveryMode, setDeliveryMode] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [addressLine, setAddressLine] = useState(defaultAddress?.line1 ?? "");
  const [comuna, setComuna] = useState(defaultAddress?.comuna ?? cart.store?.comuna ?? "Santiago");
  const [instructions, setInstructions] = useState(defaultAddress?.instructions ?? "");
  const [customerName, setCustomerName] = useState(user.name);
  const [customerPhone, setCustomerPhone] = useState(user.phone ?? "");
  const [tipChoice, setTipChoice] = useState("1000");
  const [customTip, setCustomTip] = useState("");
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>(
    flowEnabled ? "FLOW_WEBPAY" : "MERCADOPAGO",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestIdRef.current) {
      requestIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  useEffect(() => {
    if (!cart.store) return;
    if (!defaultAddress && !addressLine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComuna(cart.store.comuna);
    }
  }, [cart.store, defaultAddress, addressLine]);

  const tip = useMemo(() => {
    if (tipChoice === "custom") {
      return Math.min(10000, Math.max(0, Number(customTip) || 0));
    }
    return Number(tipChoice);
  }, [tipChoice, customTip]);

  const selectedComuna = COMUNA_BY_NAME.get(comuna);

  const fees = useMemo(() => {
    if (!cart.store) {
      return calculateFees({
        subtotal: 0,
        distanceKm: 0,
        deliveryMode,
        tip,
        commissionRate: 17,
      });
    }
    const distance = selectedComuna
      ? distanceForComuna(
          {
            lat: cart.store.lat,
            lng: cart.store.lng,
            comuna: cart.store.comuna,
          },
          selectedComuna,
        )
      : 2.4;
    return calculateFees({
      subtotal: cart.subtotal,
      distanceKm: distance,
      deliveryMode,
      tip,
      commissionRate: 17,
    });
  }, [cart.store, cart.subtotal, selectedComuna, deliveryMode, tip]);

  const belowMinimum = Boolean(cart.store && cart.subtotal < cart.store.minOrder);

  async function submit() {
    if (!cart.store) return;
    setError(null);

    if (deliveryMode === "DELIVERY" && !addressLine.trim()) {
      setError("Ingresa tu dirección de entrega.");
      return;
    }
    if (deliveryMode === "DELIVERY" && !selectedComuna) {
      setError("Selecciona una comuna válida.");
      return;
    }
    if (!customerName.trim() || customerName.trim().length < 2) {
      setError("Ingresa tu nombre.");
      return;
    }
    if (belowMinimum) {
      setError(`El pedido mínimo de este local es ${formatCLP(cart.store.minOrder)}.`);
      return;
    }

    const isFlow =
      paymentProvider === "FLOW_WEBPAY" || paymentProvider === "FLOW_MACH";
    const flowMethod =
      paymentProvider === "FLOW_WEBPAY"
        ? "webpay"
        : paymentProvider === "FLOW_MACH"
          ? "mach"
          : undefined;

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: cart.store.id,
          clientRequestId: requestIdRef.current ?? undefined,
          items: cart.items.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity,
            modifierOptionIds: line.modifiers.map((modifier) => modifier.id),
            notes: line.notes,
          })),
          deliveryMode,
          address:
            deliveryMode === "DELIVERY"
              ? {
                  line1: addressLine.trim(),
                  comuna,
                  instructions: instructions.trim() || undefined,
                }
              : undefined,
          tip,
          paymentProvider: isFlow ? "FLOW" : paymentProvider,
          flowMethod,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
        }),
      });

      const data = (await response.json()) as {
        orderId?: string;
        redirectUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.orderId) {
        setError(data.error ?? "No pudimos crear el pedido. Intenta de nuevo.");
        setSubmitting(false);
        return;
      }

      cart.clearCart();

      if (
        data.redirectUrl &&
        isTrustedPaymentRedirectUrl(data.redirectUrl, paymentProvider)
      ) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (data.redirectUrl) {
        console.error("URL de pago no confiable:", data.redirectUrl);
        setError("No pudimos redirigirte a la pasarela de pago.");
        setSubmitting(false);
        return;
      }

      router.push(`/order/${data.orderId}`);
    } catch {
      setError("Hubo un problema de conexión. Revisa tu internet e intenta de nuevo.");
      setSubmitting(false);
    }
  }

  if (!cart.isReady) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-2" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="h-96 animate-pulse rounded-xl bg-surface-2/60" />
          <div className="h-72 animate-pulse rounded-xl bg-surface-2/60" />
        </div>
      </div>
    );
  }

  if (!cart.store || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Tu carrito está vacío"
          description="Agrega platos de una cocina para continuar con el pago."
          action={<Link href="/" className="btn btn-primary">Ver cocinas</Link>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/store/${cart.store.slug}`} className="btn btn-ghost mb-4 gap-2">
        <ArrowLeft className="h-4 w-4" />
        Volver al local
      </Link>

      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Checkout
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
          Confirma tu pedido
        </h1>
        <p className="mt-1 text-sm text-muted">
          {cart.store.name} · {cart.store.comuna} · {cart.store.prepTimeMin} min de preparación
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-4">
          {/* Delivery mode */}
          <section className="card p-5">
            <h2 className="font-display text-base font-semibold">1. ¿Cómo lo recibes?</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDeliveryMode("DELIVERY")}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  deliveryMode === "DELIVERY"
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-surface-2/50 hover:border-surface-3"
                }`}
              >
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold">Delivery</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {formatCLP(fees.deliveryFee)} · {fees.distanceKm} km
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode("PICKUP")}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                  deliveryMode === "PICKUP"
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-surface-2/50 hover:border-surface-3"
                }`}
              >
                <Store className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-sm font-semibold">Retiro en local</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Sin costo de envío
                  </span>
                </span>
              </button>
            </div>
          </section>

          {/* Address */}
          {deliveryMode === "DELIVERY" && (
            <section className="card p-5">
              <h2 className="font-display text-base font-semibold">2. Dirección de entrega</h2>

              {addresses.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {addresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => {
                        setAddressLine(address.line1);
                        setComuna(address.comuna);
                        setInstructions(address.instructions ?? "");
                      }}
                      className={`badge ${
                        addressLine === address.line1 && comuna === address.comuna
                          ? "badge-primary"
                          : "badge-muted"
                      }`}
                    >
                      {address.label} · {address.comuna}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3 grid gap-3">
                <div>
                  <label htmlFor="address" className="label">Calle y número</label>
                  <input
                    id="address"
                    className="input"
                    placeholder="Av. Irarrázaval 1234, depto 56"
                    value={addressLine}
                    onChange={(event) => setAddressLine(event.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="comuna" className="label">Comuna</label>
                    <select
                      id="comuna"
                      className="select"
                      value={comuna}
                      onChange={(event) => setComuna(event.target.value)}
                    >
                      {SANTIAGO_COMUNAS.map((item) => (
                        <option key={item.name} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="phone" className="label">Teléfono</label>
                    <input
                      id="phone"
                      className="input"
                      placeholder="+56 9 1234 5678"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="instructions" className="label">Instrucciones para el repartidor</label>
                  <input
                    id="instructions"
                    className="input"
                    placeholder="Timbre, portón, dejar en conserjería…"
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Payment */}
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold">
                {deliveryMode === "DELIVERY" ? "3" : "2"}. Pago
              </h2>
              <span className="badge badge-muted">
                <Lock className="h-3 w-3" />
                {paymentsMode === "mock" ? "Modo demo" : "Pago seguro"}
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              {flowEnabled ? (
                <>
                  <PaymentOption
                    active={paymentProvider === "FLOW_WEBPAY"}
                    onClick={() => setPaymentProvider("FLOW_WEBPAY")}
                    icon={CreditCard}
                    title="Webpay"
                    description="Tarjetas de crédito, débito y prepago. Confirmación inmediata."
                  />
                  <PaymentOption
                    active={paymentProvider === "FLOW_MACH"}
                    onClick={() => setPaymentProvider("FLOW_MACH")}
                    icon={Zap}
                    title="MACH / BCI"
                    description="Paga con la app MACH o BCI. Confirmación inmediata."
                  />
                </>
              ) : (
                <>
                  <PaymentOption
                    active={paymentProvider === "MERCADOPAGO"}
                    onClick={() => setPaymentProvider("MERCADOPAGO")}
                    icon={Wallet}
                    title="Mercado Pago"
                    description="Tarjetas, saldo y cuotas. Checkout hospedado."
                  />
                  <PaymentOption
                    active={paymentProvider === "TRANSBANK"}
                    onClick={() => setPaymentProvider("TRANSBANK")}
                    icon={CreditCard}
                    title="Webpay / Transbank"
                    description="Tarjetas chilenas. Redirección segura a Webpay."
                  />
                </>
              )}
            </div>

            {paymentProvider === "FLOW_WEBPAY" && (
              <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted">
                Serás redirigido a Flow para pagar con Webpay. El local recibirá
                el pedido apenas se confirme el pago.
              </p>
            )}

            {paymentProvider === "FLOW_MACH" && (
              <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted">
                Serás redirigido a Flow para pagar con MACH o BCI. El local
                recibirá el pedido apenas se confirme el pago.
              </p>
            )}

            <div className="mt-4">
              <p className="label">Propina para el repartidor</p>
              <div className="flex flex-wrap gap-2">
                {["0", "500", "1000", "1500"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTipChoice(value)}
                    className={`badge ${
                      tipChoice === value ? "badge-primary" : "badge-muted"
                    }`}
                  >
                    {value === "0" ? "Sin propina" : formatCLP(Number(value))}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTipChoice("custom")}
                  className={`badge ${
                    tipChoice === "custom" ? "badge-primary" : "badge-muted"
                  }`}
                >
                  Otro monto
                </button>
              </div>
              {tipChoice === "custom" && (
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={100}
                  className="input mt-2 max-w-40"
                  placeholder="Monto en CLP"
                  value={customTip}
                  onChange={(event) => setCustomTip(event.target.value)}
                />
              )}
              <p className="mt-2 text-[11px] text-muted">
                100% de la propina va al repartidor. Fogón no retiene nada.
              </p>
            </div>
          </section>

          {/* Customer */}
          <section className="card p-5">
            <h2 className="font-display text-base font-semibold">
              {deliveryMode === "DELIVERY" ? "4" : "3"}. Tus datos
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="label">Nombre</label>
                <input
                  id="name"
                  className="input"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input opacity-70" value={user.email} readOnly />
              </div>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside>
          <div className="sticky top-24 space-y-3">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold">Resumen</h2>
                <span className="badge badge-muted">
                  {cart.count} {cart.count === 1 ? "ítem" : "ítems"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {cart.items.map((line) => (
                  <div key={line.key} className="flex gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-base">
                      {line.emoji ?? "🍽️"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{line.name}</p>
                      <p className="text-[10px] text-muted">
                        {line.quantity} × {formatCLP(line.unitPrice)}
                      </p>
                    </div>
                    <span className="font-mono-nums text-xs">
                      {formatCLP(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="my-4 divider" />

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="font-mono-nums">{formatCLP(fees.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">
                    Envío {deliveryMode === "DELIVERY" ? `(${fees.distanceKm} km)` : ""}
                  </dt>
                  <dd className="font-mono-nums">
                    {deliveryMode === "DELIVERY" ? formatCLP(fees.deliveryFee) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">
                    Servicio
                    {deliveryMode === "DELIVERY" && (
                      <span className="ml-1 text-[10px] text-muted/70">
                        (mín. {formatCLP(SERVICE_FEE_MIN)} / máx. {formatCLP(SERVICE_FEE_MAX)})
                      </span>
                    )}
                  </dt>
                  <dd className="font-mono-nums">
                    {deliveryMode === "DELIVERY" ? formatCLP(fees.serviceFee) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Propina</dt>
                  <dd className="font-mono-nums">{formatCLP(fees.tip)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                  <dt>Total</dt>
                  <dd className="font-mono-nums text-primary">{formatCLP(fees.total)}</dd>
                </div>
              </dl>

              {belowMinimum && (
                <p className="mt-3 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[11px] text-danger">
                  El pedido mínimo de este local es {formatCLP(cart.store.minOrder)}.
                  Agrega {formatCLP(cart.store.minOrder - cart.subtotal)} más.
                </p>
              )}

              {error && (
                <p className="mt-3 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[11px] text-danger">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={submitting || belowMinimum}
                className="btn btn-primary btn-lg mt-4 w-full"
              >
                {submitting ? "Procesando…" : `Pagar ${formatCLP(fees.total)}`}
              </button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Pago protegido. No almacenamos datos de tarjeta.
              </div>
            </div>

            <div className="card-soft p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Check className="h-3.5 w-3.5 text-success" />
                Precio final, sin sorpresas
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                El desglose incluye productos, envío, servicio y propina. El local
                recibe su parte y el repartidor el 100% de la propina.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PaymentOption({
  active,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Wallet;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
        active
          ? "border-primary/40 bg-primary/10"
          : "border-border bg-surface-2/50 hover:border-surface-3"
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-primary text-primary-ink" : "bg-surface-3 text-muted"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-[11px] text-muted">{description}</span>
      </span>
      {active && <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}
