"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  Bike,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Store,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/app/actions/auth";
import { cn, initials } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const NAV: Record<string, NavItem[]> = {
  MERCHANT: [
    { href: "/merchant", label: "Pedidos", icon: LayoutDashboard },
    { href: "/merchant/menu", label: "Menú", icon: UtensilsCrossed },
    { href: "/merchant/analytics", label: "Analítica", icon: BarChart3 },
    { href: "/kyc", label: "Verificación", icon: BadgeCheck },
    { href: "/settings/security", label: "Seguridad", icon: ShieldCheck },
  ],
  COURIER: [
    { href: "/courier", label: "Mi ruta", icon: Bike },
    { href: "/courier/earnings", label: "Ganancias", icon: Wallet },
    { href: "/kyc", label: "Verificación", icon: BadgeCheck },
    { href: "/settings/security", label: "Seguridad", icon: ShieldCheck },
  ],
  ADMIN: [
    { href: "/admin", label: "Resumen", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Pedidos", icon: ClipboardList },
    { href: "/admin/merchants", label: "Locales", icon: Store },
    { href: "/admin/couriers", label: "Repartidores", icon: Bike },
    { href: "/admin/kyc", label: "KYC", icon: BadgeCheck },
    { href: "/settings/security", label: "Seguridad", icon: ShieldCheck },
  ],
  SUPPORT: [
    { href: "/admin", label: "Resumen", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Pedidos", icon: ClipboardList },
    { href: "/admin/kyc", label: "KYC", icon: BadgeCheck },
    { href: "/settings/security", label: "Seguridad", icon: ShieldCheck },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  MERCHANT: "Panel del local",
  COURIER: "Panel repartidor",
  ADMIN: "Administración",
  SUPPORT: "Soporte",
};

export function DashboardShell({
  role,
  user,
  children,
}: {
  role: string;
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = NAV[role] ?? NAV.MERCHANT;
  const label = ROLE_LABEL[role] ?? "Panel";

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border bg-surface/50 lg:flex lg:flex-col">
        <div className="border-b border-border p-5">
          <Link href="/">
            <Logo />
          </Link>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            {label}
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/merchant" && item.href !== "/courier" && item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 font-display text-[11px] font-bold text-primary">
              {initials(user.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user.name}</p>
              <p className="truncate text-[10px] text-muted">{user.email}</p>
            </div>
          </div>
          <Link
            href="/"
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <Store className="h-3.5 w-3.5" />
            Ver sitio público
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-surface-2 hover:text-danger"
            >
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
          <Link href="/">
            <Logo compact />
          </Link>
          <span className="badge badge-muted ml-auto">{label}</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 font-display text-[10px] font-bold text-primary">
            {initials(user.name)}
          </span>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 no-scrollbar lg:hidden">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-primary text-primary-ink"
                    : "border border-border bg-surface-2 text-muted",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
