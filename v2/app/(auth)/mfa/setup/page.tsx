import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";
import { AuthShell } from "@/components/auth/auth-shell";
import { MfaForm } from "@/components/auth/mfa-form";
import { startMfaSetupAction } from "@/app/actions/mfa";
import { getMfaPending } from "@/lib/auth";
import {
  MFA_SETUP_SECRET_COOKIE,
  decryptMfaSecret,
  totpUri,
} from "@/lib/mfa";

export const dynamic = "force-dynamic";

export default async function MfaSetupPage() {
  const pending = await getMfaPending("setup");
  if (!pending) redirect("/login");
  if (pending.mfaEnabled) redirect("/settings/security");

  const store = await cookies();
  const encrypted = store.get(MFA_SETUP_SECRET_COOKIE)?.value;
  const secret = encrypted ? decryptMfaSecret(encrypted) : null;
  const uri = secret ? totpUri(secret, pending.email) : null;
  const qr = uri
    ? await QRCode.toDataURL(uri, { margin: 1, width: 260 })
    : null;

  return (
    <AuthShell
      eyebrow="Seguridad"
      title="Activa la verificación en dos pasos"
      subtitle="Protege tu cuenta de administración o local con una app autenticadora."
      footer={
        <p className="text-center text-[11px] text-muted">
          Puedes usar Google Authenticator, Authy o 1Password.
        </p>
      }
    >
      {!qr ? (
        <form action={startMfaSetupAction} className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-2/50 p-4 text-sm text-muted">
            <p className="font-semibold text-foreground">Cómo funciona</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs">
              <li>Generamos un secreto único para tu cuenta.</li>
              <li>Lo escaneas con tu app autenticadora.</li>
              <li>Confirmas con un código de 6 dígitos.</li>
              <li>Recibes códigos de recuperación de un solo uso.</li>
            </ol>
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Generar código QR
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="flex justify-center rounded-xl border border-border bg-white p-3">
            <Image
              src={qr}
              alt="Código QR para configurar MFA"
              width={260}
              height={260}
              unoptimized
            />
          </div>
          <div className="rounded-lg border border-border bg-surface-2/50 p-3">
            <p className="text-[11px] font-semibold text-muted">
              Si no puedes escanear, ingresa este secreto:
            </p>
            <code className="mt-1 block break-all text-xs font-semibold tracking-wider text-primary">
              {secret}
            </code>
          </div>
          <MfaForm mode="setup" />
        </div>
      )}
    </AuthShell>
  );
}
