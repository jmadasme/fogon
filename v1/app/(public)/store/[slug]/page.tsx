import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bike, Clock, MapPin, ShieldCheck, Star, Store as StoreIcon } from "lucide-react";
import { db } from "@/lib/db";
import { DELIVERY_BASE_FEE, DELIVERY_MODE_LABELS } from "@/lib/constants";
import { formatCLP } from "@/lib/utils";
import { StoreMenu } from "@/components/store/store-menu";

export const dynamic = "force-dynamic";

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const store = await db.store.findUnique({
    where: { slug },
    include: {
      merchant: true,
      categories: {
        orderBy: { position: "asc" },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: {
              modifiers: {
                include: { options: true },
              },
            },
          },
        },
      },
    },
  });

  if (
    !store ||
    store.status !== "ACTIVE" ||
    store.merchant.status !== "VERIFIED"
  ) {
    notFound();
  }

  const menu = store.categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      items: category.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        emoji: item.emoji,
        imageUrl: item.imageUrl,
        available: item.available,
        modifiers: item.modifiers.map((modifier) => ({
          id: modifier.id,
          name: modifier.name,
          type: modifier.type,
          required: modifier.required,
          min: modifier.min,
          max: modifier.max,
          options: modifier.options.map((option) => ({
            id: option.id,
            name: option.name,
            priceDelta: option.priceDelta,
          })),
        })),
      })),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <div>
      <div
        className="relative h-56 w-full bg-surface-3 bg-cover bg-center sm:h-72"
        style={
          store.coverUrl ? { backgroundImage: `url(${store.coverUrl})` } : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/" className="btn btn-secondary h-9 gap-2 bg-black/40 backdrop-blur">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <span className="badge border-white/10 bg-black/45 text-white backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Local verificado
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <div className="-mt-20 relative z-10 rounded-2xl border border-border bg-surface/95 p-5 shadow-2xl backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                <span>{store.emoji}</span>
                {store.cuisine}
              </div>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                {store.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                {store.description ?? "Cocina local preparada al momento."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                <span className="flex items-center gap-1 text-primary">
                  <Star className="h-4 w-4 fill-primary" />
                  <span className="font-mono-nums font-semibold">{store.rating.toFixed(1)}</span>
                  <span>({store.ratingCount} reseñas)</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {store.prepTimeMin}–{store.prepTimeMin + 10} min
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {store.address}, {store.comuna}
                </span>
                <span className="flex items-center gap-1">
                  <Bike className="h-4 w-4" />
                  {DELIVERY_MODE_LABELS[store.merchant.deliveryMode] ?? "Reparto híbrido"}
                </span>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[22rem]">
              <InfoPill label="Envío" value={`desde ${formatCLP(DELIVERY_BASE_FEE)}`} />
              <InfoPill label="Preparación" value={`${store.prepTimeMin} min`} />
              <InfoPill label="Mínimo" value={store.minOrder ? formatCLP(store.minOrder) : "$0"} />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div>
            {menu.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center">
                <StoreIcon className="mx-auto h-8 w-8 text-muted" />
                <h2 className="mt-3 font-display text-lg font-semibold">Menú en preparación</h2>
                <p className="mt-1 text-sm text-muted">
                  Este local está cargando sus platos. Vuelve pronto.
                </p>
              </div>
            ) : (
              <StoreMenu
                store={{
                  id: store.id,
                  name: store.name,
                  slug: store.slug,
                  emoji: store.emoji,
                  comuna: store.comuna,
                  prepTimeMin: store.prepTimeMin,
                  lat: store.lat,
                  lng: store.lng,
                  minOrder: store.minOrder,
                }}
                categories={menu}
              />
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-3">
              <div className="card p-5">
                <h2 className="font-display text-sm font-semibold">Lo que debes saber</h2>
                <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted">
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    Precio final antes de pagar. Sin cargos sorpresa.
                  </li>
                  <li className="flex gap-2">
                    <Bike className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    El local decide si entrega él o usa la red Fogón.
                  </li>
                  <li className="flex gap-2">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                    El tiempo es estimado y se actualiza con la operación real.
                  </li>
                  <li className="flex gap-2">
                    <Star className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    Tu calificación ayuda a mantener la calidad del barrio.
                  </li>
                </ul>
              </div>
              <div className="card border-primary/20 bg-primary/5 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  Comisión justa
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Este local paga entre 12% y 22% + IVA según su plan. No 30%.
                  Así puede invertir en mejor comida y mejores sueldos.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/70 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-0.5 font-mono-nums text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
