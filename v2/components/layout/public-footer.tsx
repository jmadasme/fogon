import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SANTIAGO_COMUNAS } from "@/lib/constants";

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            La infraestructura digital de la cocina local. Comisión justa,
            logística híbrida y el local dueño de su cliente.
          </p>
          <p className="mt-4 text-[11px] text-muted/70">
            Santiago, Chile · 2026
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
            Pedir
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/" className="hover:text-foreground">Cocinas</Link></li>
            <li><Link href="/orders" className="hover:text-foreground">Mis pedidos</Link></li>
            <li><Link href="/register" className="hover:text-foreground">Crear cuenta</Link></li>
            <li><Link href="/login" className="hover:text-foreground">Ingresar</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
            Sumarse
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/registro/local" className="hover:text-foreground">Soy cocina</Link></li>
            <li><Link href="/registro/repartidor" className="hover:text-foreground">Soy repartidor</Link></li>
            <li><Link href="/para-locales" className="hover:text-foreground">Planes y comisiones</Link></li>
            <li><Link href="/para-repartidores" className="hover:text-foreground">Cómo funciona</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
            Legal
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link href="/legal/terminos" className="hover:text-foreground">Términos</Link></li>
            <li><Link href="/legal/privacidad" className="hover:text-foreground">Privacidad</Link></li>
            <li><Link href="/legal/reembolsos" className="hover:text-foreground">Reembolsos</Link></li>
            <li><Link href="/soporte" className="hover:text-foreground">Soporte</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[11px] text-muted/70 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Fogón. Todos los derechos reservados.</p>
          <p>
            Cobertura en {SANTIAGO_COMUNAS.length} comunas de Santiago.
          </p>
        </div>
      </div>
    </footer>
  );
}
