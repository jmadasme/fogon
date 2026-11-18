import Link from "next/link";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireUser } from "@/lib/auth";
import { refreshKycFromProvider } from "@/lib/kyc";

export const dynamic = "force-dynamic";

export default async function KycReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ verificationSessionId?: string; status?: string }>;
}) {
  const params = await searchParams;
  const rawSessionId = params.verificationSessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const nextPath = sessionId
    ? `/kyc/return?verificationSessionId=${encodeURIComponent(sessionId)}`
    : "/kyc/return";
  const session = await requireUser(nextPath);
  let status: string | null = null;
  let error: string | null = null;

  if (sessionId) {
    if (sessionId.length > 200) {
      error = "La referencia de verificación no es válida.";
    } else {
      try {
        const record = await refreshKycFromProvider(sessionId, session.id);
        if (!record) {
          error =
            "No encontramos una verificación asociada a tu cuenta. Inicia el proceso desde tu panel.";
        } else {
          status = record.status;
        }
      } catch {
        error =
          "Recibimos tu verificación, pero aún no podemos consultar el resultado. Intenta recargar en unos segundos.";
      }
    }
  }

  return (
    <AuthShell
      eyebrow="Verificación"
      title={
        status === "APPROVED"
          ? "Verificación aprobada"
          : status === "REJECTED"
            ? "Verificación rechazada"
            : "Verificación recibida"
      }
      subtitle={
        error ??
        (status === "APPROVED"
          ? "Tu identidad quedó validada. Ya puedes volver a Fogón y operar."
          : status === "REJECTED"
            ? "El proveedor rechazó la verificación. Revisa el motivo en tu panel."
            : "Estamos esperando la decisión del proveedor. Esto puede tardar unos segundos.")
      }
      footer={
        <p className="text-center text-[11px] text-muted">
          ¿Problemas?{" "}
          <Link href="/soporte" className="text-primary hover:underline">
            Contacta a soporte
          </Link>
        </p>
      }
    >
      <div className="space-y-4 text-center">
        {status === "APPROVED" ? (
          <BadgeCheck className="mx-auto h-14 w-14 text-success" />
        ) : status === "REJECTED" ? (
          <ShieldAlert className="mx-auto h-14 w-14 text-danger" />
        ) : (
          <Clock className="mx-auto h-14 w-14 text-primary" />
        )}
        <div className="flex justify-center gap-2">
          <Link href="/kyc" className="btn btn-primary">
            Ir a mi verificación
          </Link>
          <Link href="/" className="btn btn-secondary">
            Ir a Fogón
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
