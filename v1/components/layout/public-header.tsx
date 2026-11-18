import Link from "next/link";
import {
  Bike,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Shield,
  Store,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { CartButton } from "@/components/cart/cart-button";
import { CommuneSelect } from "@/components/layout/commune-select";
import { SearchBox } from "@/components/layout/search-box";
import { logoutAction } from "@/app/actions/auth";

export async function PublicHeader() {
  const user = await getSession();
  const dashboardHref = user ? ROLE_HOME[user.role] ?? "/" : "/login";
  const dashboardLabel =
    user?.role === "MERCHANT"
      ? "Panel del local"
      : user?.role === "COURIER"
        ? "Panel repartidor"
        : user?.role === "ADMIN"
          ? "Administración"
          : "Mi cuenta";

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="shrink-0" aria-label="Fogón, inicio">
          <Logo />
        </Link>

        <div className="ml-2 hidden items-center gap-2 lg:flex">
          <CommuneSelect />
          <SearchBox className="w-80" />
        </div>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Cocinas
          </Link>
          <Link
            href="/para-locales"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Para locales
          </Link>
          <Link
            href="/para-repartidores"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Repartidores
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <CartButton />
          {user ? (
            <details className="group relative">
              <summary className="btn btn-secondary list-none gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 font-display text-[10px] font-bold text-primary">
                  {initials(user.name)}
                </span>
                <span className="hidden max-w-[7rem] truncate sm:inline">{user.name.split(" ")[0]}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-[11px] text-muted">{user.email}</p>
                </div>
                <div className="p-1.5">
                  <Link
                    href={dashboardHref}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-surface-2"
                  >
                    {user.role === "MERCHANT" ? (
                      <Store className="h-4 w-4" />
                    ) : user.role === "COURIER" ? (
                      <Bike className="h-4 w-4" />
                    ) : user.role === "ADMIN" ? (
                      <Shield className="h-4 w-4" />
                    ) : (
                      <LayoutDashboard className="h-4 w-4" />
                    )}
                    {dashboardLabel}
                  </Link>
                  {user.role === "CUSTOMER" && (
                    <Link
                      href="/orders"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-surface-2"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Mis pedidos
                    </Link>
                  )}
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-danger"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              </div>
            </details>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn btn-ghost">
                Ingresar
              </Link>
              <Link href="/register" className="btn btn-primary">
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-2 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <CommuneSelect compact />
          <SearchBox className="flex-1" />
        </div>
      </div>
    </header>
  );
}
