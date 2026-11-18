import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { finishMfaSetupAction } from "@/app/actions/mfa";
import { getSession } from "@/lib/auth";
import { MFA_RECOVERY_COOKIE } from "@/lib/mfa";

export const dynamic = "force-dynamic";

export default async function MfaRecoveryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const store = await cookies();
  const raw = store.get(MFA_RECOVERY_COOKIE)?.value;
  let codes: string[] = [];
  try {
    codes = raw ? JSON.parse(raw) : [];
  } catch {
    codes = [];
  }
  if (codes.length === 0) redirect("/settings/security");

  return (
    <AuthShell
      eyebrow="Seguridad"
      title="Guarda tus códigos de recuperación"
      subtitle="Son de un solo uso. No se volverán a mostrar. Guárdalos fuera del teléfono."
      footer={
        <p className="text-center text-[11px] text-muted">
          Si los pierdes, necesitarás contactar a soporte para recuperar la
          cuenta.
        </p>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {codes.map((code) => (
            <code
              key={code}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-center text-xs font-semibold tracking-wider"
            >
              {code}
            </code>
          ))}
        </div>
        <form action={finishMfaSetupAction}>
          <button type="submit" className="btn btn-primary w-full">
            Ya guardé mis códigos
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
