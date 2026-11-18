"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, Bike, Store } from "lucide-react";
import {
  loginAction,
  registerCourierAction,
  registerCustomerAction,
  registerMerchantAction,
} from "@/app/actions/auth";
import { CUISINE_NAMES, CUISINES, SANTIAGO_COMUNAS } from "@/lib/constants";

type AuthState = { error?: string };

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs text-danger">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
      {pending ? "Procesando…" : children}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="input"
        {...(value !== undefined
          ? { value, onChange: (event) => onChange?.(event.target.value) }
          : {})}
      />
    </div>
  );
}

export function LoginForm({
  next,
  showDemo,
}: {
  next?: string;
  showDemo: boolean;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    loginAction,
    {},
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const demoAccounts = [
    { label: "Cliente", email: "cliente@fogon.cl" },
    { label: "Local", email: "local@fogon.cl" },
    { label: "Repartidor", email: "repartidor@fogon.cl" },
    { label: "Admin", email: "admin@fogon.cl" },
  ];

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state.error} />
      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="tu@email.cl"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <SubmitButton pending={pending}>
        Ingresar
        <ArrowRight className="h-4 w-4" />
      </SubmitButton>

      {showDemo && (
        <div className="rounded-xl border border-border bg-surface/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Cuentas de prueba
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword("fogon123");
                }}
                className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-left text-[11px] text-muted transition hover:border-primary/30 hover:text-foreground"
              >
                <span className="block font-semibold text-foreground/90">{account.label}</span>
                <span className="block truncate">{account.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted">
            Contraseña: <span className="font-mono-nums text-foreground/80">fogon123</span>
          </p>
        </div>
      )}
    </form>
  );
}

export function RegisterCustomerForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registerCustomerAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Nombre" name="name" placeholder="Tu nombre" autoComplete="name" />
      <Field label="Email" name="email" type="email" placeholder="tu@email.cl" autoComplete="email" />
      <Field label="Teléfono" name="phone" type="tel" placeholder="+56 9 1234 5678" autoComplete="tel" required={false} />
      <Field label="Contraseña" name="password" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
      <SubmitButton pending={pending}>
        Crear cuenta
        <ArrowRight className="h-4 w-4" />
      </SubmitButton>
      <p className="text-center text-[11px] text-muted">
        Al crear una cuenta aceptas los{" "}
        <Link href="/legal/terminos" className="text-primary hover:underline">términos</Link>{" "}
        y la{" "}
        <Link href="/legal/privacidad" className="text-primary hover:underline">política de privacidad</Link>.
      </p>
    </form>
  );
}

export function RegisterMerchantForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registerMerchantAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tu nombre" name="name" placeholder="Nombre del responsable" autoComplete="name" />
        <Field label="Teléfono" name="phone" type="tel" placeholder="+56 9 1234 5678" autoComplete="tel" required={false} />
      </div>
      <Field label="Email" name="email" type="email" placeholder="local@email.cl" autoComplete="email" />
      <Field label="Contraseña" name="password" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
      <div className="divider" />
      <Field label="Nombre del local" name="storeName" placeholder="La Cocina de la Abuela" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="comuna" className="label">Comuna</label>
          <select id="comuna" name="comuna" className="select" defaultValue="Ñuñoa">
            {SANTIAGO_COMUNAS.map((comuna) => (
              <option key={comuna.name} value={comuna.name}>{comuna.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cuisine" className="label">Tipo de cocina</label>
          <select id="cuisine" name="cuisine" className="select" defaultValue="Chilena">
            {CUISINE_NAMES.map((name) => (
              <option key={name} value={name}>{CUISINES[name].emoji} {name}</option>
            ))}
          </select>
        </div>
      </div>
      <Field label="Dirección" name="address" placeholder="Av. Irarrázaval 1234" />
      <div>
        <p className="label">¿Cómo repartes?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { value: "OWN", label: "Propio", hint: "Mi repartidor" },
            { value: "HYBRID", label: "Híbrido", hint: "Propio o Fogón" },
            { value: "FREELANCE", label: "Fogón", hint: "Red de repartidores" },
          ].map((option, index) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface-2/50 p-2.5 text-left text-xs transition has-[:checked]:border-primary/40 has-[:checked]:bg-primary/10"
            >
              <input
                type="radio"
                name="deliveryMode"
                value={option.value}
                defaultChecked={index === 1}
                className="mt-0.5 accent-[var(--primary)]"
              />
              <span>
                <span className="block font-semibold">{option.label}</span>
                <span className="block text-[10px] text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <SubmitButton pending={pending}>
        <Store className="h-4 w-4" />
        Registrar mi cocina
      </SubmitButton>
      <p className="text-center text-[11px] text-muted">
        Tu local quedará en revisión. Podrás cargar el menú mientras tanto.
      </p>
    </form>
  );
}

export function RegisterCourierForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    registerCourierAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <FormError message={state.error} />
      <Field label="Nombre" name="name" placeholder="Tu nombre" autoComplete="name" />
      <Field label="Email" name="email" type="email" placeholder="tu@email.cl" autoComplete="email" />
      <Field label="Teléfono" name="phone" type="tel" placeholder="+56 9 1234 5678" autoComplete="tel" />
      <Field label="Contraseña" name="password" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="vehicle" className="label">Vehículo</label>
          <select id="vehicle" name="vehicle" className="select" defaultValue="MOTORCYCLE">
            <option value="BIKE">Bicicleta</option>
            <option value="MOTORCYCLE">Moto</option>
            <option value="CAR">Auto</option>
            <option value="WALKING">A pie</option>
          </select>
        </div>
        <div>
          <label htmlFor="zone" className="label">Zona principal</label>
          <select id="zone" name="zone" className="select" defaultValue="Ñuñoa">
            {SANTIAGO_COMUNAS.map((comuna) => (
              <option key={comuna.name} value={comuna.name}>{comuna.name}</option>
            ))}
          </select>
        </div>
      </div>
      <SubmitButton pending={pending}>
        <Bike className="h-4 w-4" />
        Quiero repartir
      </SubmitButton>
      <p className="text-center text-[11px] text-muted">
        Verificaremos tu identidad y documentos antes de activar tu cuenta.
      </p>
    </form>
  );
}

export function AuthLinks({ type }: { type: "login" | "register" }) {
  if (type === "login") {
    return (
      <div className="space-y-3 text-center text-xs text-muted">
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Crear cuenta
          </Link>
        </p>
        <p className="flex items-center justify-center gap-3">
          <Link href="/registro/local" className="inline-flex items-center gap-1 hover:text-foreground">
            <Store className="h-3.5 w-3.5" /> Soy local
          </Link>
          <span className="text-border">·</span>
          <Link href="/registro/repartidor" className="inline-flex items-center gap-1 hover:text-foreground">
            <Bike className="h-3.5 w-3.5" /> Soy repartidor
          </Link>
        </p>
      </div>
    );
  }
  return (
    <p className="text-center text-xs text-muted">
      ¿Ya tienes cuenta?{" "}
      <Link href="/login" className="font-semibold text-primary hover:underline">
        Ingresar
      </Link>
    </p>
  );
}
