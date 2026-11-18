import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCLP } from "@/lib/utils";
import {
  createCategoryAction,
  createMenuItemAction,
  deleteMenuItemAction,
  toggleMenuItemAction,
  updateMenuItemAction,
} from "@/app/actions/menu";
import { EmptyState } from "@/components/ui/empty-state";
import { CoverUpload } from "@/components/merchant/cover-upload";

export const dynamic = "force-dynamic";

export default async function MerchantMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/merchant/menu");

  const merchant = await db.merchant.findUnique({
    where: { ownerId: session.id },
    include: { stores: { orderBy: { createdAt: "asc" } } },
  });
  if (!merchant) redirect("/registro/local");
  if (merchant.stores.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Configura tu local primero"
        description="Necesitas una sucursal para cargar tu menú."
        action={<Link href="/registro/local" className="btn btn-primary">Crear local</Link>}
      />
    );
  }

  const params = await searchParams;
  const activeStore =
    merchant.stores.find((store) => store.id === params.store) ?? merchant.stores[0];

  const categories = await db.category.findMany({
    where: { storeId: activeStore.id },
    orderBy: { position: "asc" },
    include: { items: { orderBy: { position: "asc" } } },
  });

  const totalItems = categories.reduce((sum, category) => sum + category.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Catálogo
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            Menú de {activeStore.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {categories.length} categorías · {totalItems} platos ·{" "}
            {activeStore.status === "ACTIVE" ? "Visible en Fogón" : "En revisión"}
          </p>
        </div>
        <Link href="/merchant" className="btn btn-secondary">
          Volver a pedidos
        </Link>
      </div>

      {merchant.stores.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {merchant.stores.map((store) => (
            <Link
              key={store.id}
              href={`/merchant/menu?store=${store.id}`}
              className={`badge shrink-0 ${
                store.id === activeStore.id ? "badge-primary" : "badge-muted"
              }`}
            >
              {store.emoji} {store.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          {categories.length === 0 && (
            <EmptyState
              icon={UtensilsCrossed}
              title="Tu menú está vacío"
              description="Crea una categoría y agrega tus primeros platos para empezar a vender."
            />
          )}

          {categories.map((category) => (
            <section key={category.id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">{category.name}</h2>
                  <p className="text-[11px] text-muted">
                    {category.items.length} {category.items.length === 1 ? "plato" : "platos"}
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {category.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-surface-2/40 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xl">
                        {item.emoji ?? "🍽️"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          {!item.available && <span className="badge badge-danger">Agotado</span>}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="font-mono-nums text-sm font-bold text-primary">
                        {formatCLP(item.price)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <form action={toggleMenuItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="available" value={String(!item.available)} />
                        <button type="submit" className="btn btn-secondary btn-sm">
                          {item.available ? "Marcar agotado" : "Reactivar"}
                        </button>
                      </form>
                      <form action={deleteMenuItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button type="submit" className="btn btn-danger btn-sm gap-1">
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      </form>
                      <details className="group w-full">
                        <summary className="mt-1 flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-muted hover:text-foreground">
                          <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
                          Editar plato
                        </summary>
                        <form action={updateMenuItemAction} className="mt-2 grid gap-2 sm:grid-cols-2">
                          <input type="hidden" name="itemId" value={item.id} />
                          <input
                            name="name"
                            defaultValue={item.name}
                            className="input h-9 text-xs"
                            placeholder="Nombre"
                            required
                          />
                          <input
                            name="price"
                            type="number"
                            min={100}
                            step={100}
                            defaultValue={item.price}
                            className="input h-9 text-xs"
                            placeholder="Precio"
                            required
                          />
                          <input
                            name="description"
                            defaultValue={item.description ?? ""}
                            className="input h-9 text-xs sm:col-span-2"
                            placeholder="Descripción"
                          />
                          <input
                            name="emoji"
                            defaultValue={item.emoji ?? ""}
                            className="input h-9 text-xs"
                            placeholder="Emoji"
                            maxLength={4}
                          />
                          <button type="submit" className="btn btn-primary btn-sm">
                            Guardar cambios
                          </button>
                        </form>
                      </details>
                    </div>
                  </div>
                ))}
              </div>

              <details className="group mt-3">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted transition hover:border-primary/30 hover:text-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Agregar plato a {category.name}
                </summary>
                <form action={createMenuItemAction} className="mt-3 grid gap-2 rounded-xl border border-border bg-surface-2/40 p-3 sm:grid-cols-2">
                  <input type="hidden" name="categoryId" value={category.id} />
                  <input name="name" className="input h-9 text-xs" placeholder="Nombre del plato" required />
                  <input name="price" type="number" min={100} step={100} className="input h-9 text-xs" placeholder="Precio CLP" required />
                  <input name="description" className="input h-9 text-xs sm:col-span-2" placeholder="Descripción breve" />
                  <input name="emoji" className="input h-9 text-xs" placeholder="Emoji (opcional)" maxLength={4} />
                  <input name="imageUrl" className="input h-9 text-xs" placeholder="URL de imagen (opcional)" />
                  <button type="submit" className="btn btn-primary btn-sm sm:col-span-2">
                    <Plus className="h-3.5 w-3.5" />
                    Agregar al menú
                  </button>
                </form>
              </details>
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="font-display text-sm font-semibold">Portada del local</h2>
            <p className="mt-1 text-[11px] text-muted">
              La foto que ven los clientes en la app y en la web.
            </p>
            <CoverUpload storeId={activeStore.id} currentUrl={activeStore.coverUrl} />
          </div>

          <div className="card p-4">
            <h2 className="font-display text-sm font-semibold">Nueva categoría</h2>
            <p className="mt-1 text-[11px] text-muted">
              Organiza tu menú: entradas, platos fuertes, postres, bebidas.
            </p>
            <form action={createCategoryAction} className="mt-3 space-y-2">
              <input type="hidden" name="storeId" value={activeStore.id} />
              <input
                name="name"
                className="input h-9 text-xs"
                placeholder="Ej: Platos de fondo"
                required
              />
              <button type="submit" className="btn btn-secondary btn-sm w-full">
                <Plus className="h-3.5 w-3.5" />
                Crear categoría
              </button>
            </form>
          </div>

          <div className="card-soft p-4">
            <p className="text-[11px] font-semibold text-foreground">Consejos de menú</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>• Fotos claras y precios exactos aumentan la conversión.</li>
              <li>• Marca “agotado” en vez de eliminar un plato que volverá.</li>
              <li>• Menos de 20 platos bien elegidos venden más que 60 dispersos.</li>
              <li>• Revisa tiempos de preparación antes del horario peak.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
