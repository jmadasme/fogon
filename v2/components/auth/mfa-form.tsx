"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import {
  verifyMfaLoginAction,
  verifyMfaSetupAction,
  type MfaState,
} from "@/app/actions/mfa";

export function MfaForm({ mode }: { mode: "login" | "setup" }) {
  const action = mode === "setup" ? verifyMfaSetupAction : verifyMfaLoginAction;
  const [state, formAction, pending] = useActionState<MfaState, FormData>(
    action,
    {},
  );
  const [useRecovery, setUseRecovery] = useState(false);

  if (state.ok && state.recoveryCodes) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <ShieldCheck className="h-4 w-4" />
            MFA activado
          </p>
          <p className="mt-1 text-xs text-muted">
            Guarda estos códigos de recuperación en un lugar seguro. No se
            volverán a mostrar.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {state.recoveryCodes.map((code) => (
            <code
              key={code}
              className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-center text-xs font-semibold tracking-wider"
            >
              {code}
            </code>
          ))}
        </div>
        <Link href="/" className="btn btn-primary w-full">
          Ir al panel
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      {!useRecovery ? (
        <div>
          <label htmlFor="code" className="label">
            Código de 6 dígitos
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            className="input text-center text-lg tracking-[0.35em]"
          />
          {mode === "login" && (
            <button
              type="button"
              onClick={() => setUseRecovery(true)}
              className="mt-2 text-[11px] text-muted hover:text-foreground"
            >
              Usar un código de recuperación
            </button>
          )}
        </div>
      ) : (
        <div>
          <label htmlFor="recoveryCode" className="label">
            Código de recuperación
          </label>
          <input
            id="recoveryCode"
            name="recoveryCode"
            autoComplete="one-time-code"
            maxLength={11}
            required
            autoFocus
            placeholder="ABCDE-12345"
            className="input text-center uppercase tracking-wider"
          />
          <button
            type="button"
            onClick={() => setUseRecovery(false)}
            className="mt-2 text-[11px] text-muted hover:text-foreground"
          >
            Usar código de la app
          </button>
        </div>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando…
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4" />
            {mode === "setup" ? "Activar MFA" : "Verificar y entrar"}
          </>
        )}
      </button>

      {mode === "login" && (
        <p className="text-center text-[11px] text-muted">
          ¿Perdiste el teléfono? Usa un código de recuperación o contacta a
          soporte.
        </p>
      )}
    </form>
  );
}
