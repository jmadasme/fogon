import { redirect } from "next/navigation";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { startMfaSetupAction } from "@/app/actions/mfa";
import {
  resendEmailVerificationAction,
  startPhoneVerificationAction,
  updatePhoneAction,
  verifyPhoneAction,
} from "@/app/actions/verification";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "email=sent": "Te enviamos un enlace de verificación a tu correo.",
  "email=already": "Tu email ya está verificado.",
  "email=error": "No pudimos enviar el email. Revisa la configuración de correo.",
  "email=ratelimit": "Demasiados envíos. Espera un rato.",
  "phone=saved": "Teléfono guardado. Ahora envía el código SMS para verificarlo.",
  "phone=bad_format": "Teléfono inválido. Usa el formato +56 9 1234 5678.",
  "phone=taken": "Ese teléfono ya está registrado en otra cuenta.",
  "phone=sent": "Te enviamos un código por SMS. En desarrollo, revisa el log del servidor.",
  "phone=verified": "Tu teléfono quedó verificado.",
  "phone=invalid": "El código es incorrecto o venció.",
  "phone=missing": "No tienes un teléfono registrado.",
  "phone=already": "Tu teléfono ya está verificado.",
  "phone=ratelimit": "Demasiados intentos. Espera unos minutos.",
  "phone=error": "No pudimos enviar el SMS. Configura Twilio o revisa el log del servidor.",
  "mfa=unsupported":
    "MFA todavía no está disponible para repartidores en la app móvil. Puedes activarlo más adelante desde la web cuando esté habilitado.",
};

export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; phone?: string }>;
}) {
  const user = await requireUser("/settings/security");
  if (!["ADMIN", "SUPPORT", "MERCHANT", "COURIER"].includes(user.role)) redirect("/");

  const params = await searchParams;
  const record = await db.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      phone: true,
      mfaEnabled: true,
      mfaEnabledAt: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
    },
  });

  const smsConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM,
  );
  const canUseMfa = ["ADMIN", "SUPPORT", "MERCHANT"].includes(user.role);

  const messageKey = params.email
    ? `email=${params.email}`
    : params.phone
      ? `phone=${params.phone}`
      : null;
  const message = messageKey ? MESSAGES[messageKey] : null;

  return (
    <DashboardShell role={user.role} user={{ name: user.name, email: user.email }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Seguridad
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">
           Tu cuenta protegida
          </h1>
          <p className="mt-1 text-sm text-muted">
            MFA, email y teléfono para reducir el riesgo de robo de cuenta.
          </p>
        </div>

        {message && (
          <p className="rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-xs text-muted">
            {message}
          </p>
        )}

        {canUseMfa && (
        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">
                {record?.mfaEnabled ? "MFA activo" : "MFA desactivado"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {record?.mfaEnabled
                  ? `Activo desde ${record.mfaEnabledAt?.toLocaleDateString("es-CL") ?? "hoy"}. Usa tu app autenticadora o un código de recuperación al iniciar sesión.`
                  : "Recomendado para administradores y dueños de locales. Se pedirá en cada inicio de sesión."}
              </p>

              {!record?.mfaEnabled && (
                <form action={startMfaSetupAction} className="mt-4">
                  <button type="submit" className="btn btn-primary">
                    Configurar MFA
                  </button>
                </form>
              )}

              {record?.mfaEnabled && (
                <p className="mt-4 rounded-lg border border-border bg-surface-2/50 p-3 text-[11px] text-muted">
                  Guarda tus códigos de recuperación en un lugar seguro. Si
                  pierdes el teléfono, son la única forma de entrar sin soporte.
                </p>
              )}
            </div>
          </div>
        </div>
        )}

        {!canUseMfa && (
          <div className="card p-5">
            <p className="font-semibold">MFA en la app móvil</p>
            <p className="mt-1 text-xs text-muted">
              La verificación en dos pasos todavía no está disponible para
              repartidores en la app móvil. No la actives desde la web hasta
              que ese flujo esté habilitado.
            </p>
          </div>
        )}

        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Mail className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">
                Email {record?.emailVerifiedAt ? "verificado" : "sin verificar"}
              </p>
              <p className="mt-1 text-xs text-muted">{record?.email}</p>
              {!record?.emailVerifiedAt && (
                <form action={resendEmailVerificationAction} className="mt-4">
                  <button type="submit" className="btn btn-secondary">
                    Enviar verificación
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Phone className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">
                Teléfono {record?.phoneVerifiedAt ? "verificado" : "sin verificar"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {record?.phone ?? "Sin teléfono registrado"}
              </p>

              {!record?.phone && smsConfigured && (
                <form action={updatePhoneAction} className="mt-4 space-y-2">
                  <input
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+56 9 1234 5678"
                    className="input h-10"
                    required
                  />
                  <button type="submit" className="btn btn-primary">
                    Guardar teléfono
                  </button>
                </form>
              )}

              {!smsConfigured && !record?.phoneVerifiedAt && (
                <p className="mt-2 text-[10px] text-muted">
                  Verificación por SMS opcional. No está configurada en este
                  entorno.
                </p>
              )}

              {smsConfigured && record?.phone && !record.phoneVerifiedAt && (
                <>
                  <form action={startPhoneVerificationAction} className="mt-4">
                    <button type="submit" className="btn btn-secondary">
                      Enviar código SMS
                    </button>
                  </form>
                  <form action={verifyPhoneAction} className="mt-3 flex gap-2">
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="123456"
                      className="input h-10 text-center tracking-[0.25em]"
                      required
                    />
                    <button type="submit" className="btn btn-primary shrink-0">
                      Confirmar
                    </button>
                  </form>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] text-muted hover:text-foreground">
                      Cambiar número
                    </summary>
                    <form action={updatePhoneAction} className="mt-2 flex gap-2">
                      <input
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="+56 9 1234 5678"
                        className="input h-10"
                        required
                      />
                      <button type="submit" className="btn btn-secondary shrink-0">
                        Guardar
                      </button>
                    </form>
                  </details>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
