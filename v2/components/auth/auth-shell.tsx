import Link from "next/link";
import { ArrowLeft, Bike, ShieldCheck, Store } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-surface/40 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(240,185,11,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(255,122,26,0.1),transparent_50%)]" />
        <div className="relative z-10 p-10">
          <Link href="/">
            <Logo />
          </Link>
          <div className="mt-24 max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              La cocina local, con reglas claras
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight">
              Vende más.
              <br />
              Quédate con más.
              <br />
              <span className="text-primary">Tú decides cómo repartir.</span>
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-muted">
              Fogón conecta cocinas de barrio con clientes de toda Santiago.
              Comisión desde 12%, logística híbrida y tus clientes siguen siendo
              tuyos.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid gap-3 p-10 sm:grid-cols-3">
          <AuthStat icon={Store} label="34 comunas" />
          <AuthStat icon={Bike} label="Reparto híbrido" />
          <AuthStat icon={ShieldCheck} label="Pago seguro" />
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between p-5 lg:p-8">
          <Link href="/" className="lg:hidden">
            <Logo compact />
          </Link>
          <Link href="/" className="btn btn-ghost ml-auto gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al sitio
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}

function AuthStat({ icon: Icon, label }: { icon: typeof Store; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-3 backdrop-blur">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}
