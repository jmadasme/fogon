// En el contenedor las variables llegan por entorno; en local se leen del .env.
try {
  await import("dotenv/config");
} catch {
  // dotenv es opcional en la imagen standalone.
}

const production =
  process.env.NODE_ENV === "production" ||
  process.env.npm_lifecycle_event === "start";
const errors = [];
const warnings = [];

function weak(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length < 32 ||
    ["change-me", "changeme", "secret", "password"].includes(normalized)
  );
}

function placeholder(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "change-me" ||
    normalized === "changeme" ||
    normalized.includes("reemplaza") ||
    normalized.includes("placeholder") ||
    normalized.includes("example.com")
  );
}

if (weak(process.env.AUTH_SECRET)) {
  const message = "AUTH_SECRET debe ser aleatorio y tener al menos 32 caracteres.";
  if (production) errors.push(message);
  else warnings.push(message);
}

if (weak(process.env.CRON_SECRET)) {
  const message = "CRON_SECRET debe ser aleatorio y tener al menos 32 caracteres.";
  if (production) errors.push(message);
  else warnings.push(message);
}

if (
  process.env.AUTH_SECRET &&
  process.env.CRON_SECRET &&
  process.env.AUTH_SECRET === process.env.CRON_SECRET
) {
  errors.push("AUTH_SECRET y CRON_SECRET no deben ser iguales.");
}

if ((process.env.CORS_ORIGINS ?? "").split(",").includes("*")) {
  errors.push("CORS_ORIGINS no puede contener '*'.");
}

if (production) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appUrl.startsWith("https://")) {
    errors.push("NEXT_PUBLIC_APP_URL debe usar HTTPS en producción.");
  }

  const paymentsMode = process.env.PAYMENTS_MODE ?? "mock";
  if (!["production", "sandbox"].includes(paymentsMode)) {
    errors.push("PAYMENTS_MODE debe ser 'production' o 'sandbox' en producción.");
  }

  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    errors.push("NEXT_PUBLIC_DEMO_MODE debe estar desactivado en producción.");
  }

  if (process.env.MFA_ENFORCED !== "true") {
    errors.push("MFA_ENFORCED debe ser 'true' en producción para admin y locales.");
  }

  if (weak(process.env.MFA_ENCRYPTION_KEY)) {
    errors.push(
      "MFA_ENCRYPTION_KEY debe ser aleatoria y tener al menos 32 caracteres.",
    );
  }

  if (process.env.KYC_REQUIRED !== "true") {
    errors.push(
      "KYC_REQUIRED debe ser 'true' en producción para locales y repartidores.",
    );
  }

  if (!process.env.KYC_PROVIDER || process.env.KYC_PROVIDER === "mock") {
    errors.push(
      "KYC_PROVIDER debe ser un proveedor real (Sumsub/Onfido) en producción.",
    );
  }

  if (process.env.EMAIL_VERIFICATION_REQUIRED !== "true") {
    errors.push(
      "EMAIL_VERIFICATION_REQUIRED debe ser 'true' en producción.",
    );
  }

  if (process.env.COURIER_SECURITY_ENFORCED !== "true") {
    errors.push(
      "COURIER_SECURITY_ENFORCED debe ser 'true' en producción.",
    );
  }

  if (process.env.KYC_PROVIDER === "didit") {
    if (
      placeholder(process.env.DIDIT_API_KEY) ||
      (process.env.DIDIT_API_KEY ?? "").trim().length < 20
    ) {
      errors.push("DIDIT_API_KEY debe ser una API key real de Didit.");
    }
    if (
      placeholder(process.env.DIDIT_WORKFLOW_ID) ||
      (process.env.DIDIT_WORKFLOW_ID ?? "").trim().length < 8
    ) {
      errors.push("DIDIT_WORKFLOW_ID debe ser el workflow real de Didit.");
    }
    if (weak(process.env.DIDIT_WEBHOOK_SECRET)) {
      errors.push(
        "DIDIT_WEBHOOK_SECRET debe ser aleatorio y tener al menos 32 caracteres.",
      );
    }
  } else if (process.env.KYC_PROVIDER !== "mock") {
    if (!process.env.KYC_HOSTED_URL) {
      errors.push("KYC_HOSTED_URL es obligatorio con un proveedor KYC real.");
    }
    if (weak(process.env.KYC_WEBHOOK_SECRET)) {
      errors.push(
        "KYC_WEBHOOK_SECRET debe ser aleatorio y tener al menos 32 caracteres.",
      );
    }
    if (
      process.env.KYC_HOSTED_URL &&
      !process.env.KYC_HOSTED_URL.startsWith("https://")
    ) {
      errors.push("KYC_HOSTED_URL debe usar HTTPS en producción.");
    }
  }

  if (
    process.env.DIDIT_CALLBACK_URL &&
    !process.env.DIDIT_CALLBACK_URL.startsWith("https://")
  ) {
    errors.push("DIDIT_CALLBACK_URL debe usar HTTPS en producción.");
  }

  if (
    paymentsMode !== "mock" &&
    process.env.MERCADOPAGO_ACCESS_TOKEN &&
    !process.env.MERCADOPAGO_WEBHOOK_SECRET
  ) {
    errors.push(
      "MERCADOPAGO_WEBHOOK_SECRET es obligatorio si Mercado Pago está activo.",
    );
  }

  if (
    process.env.TRANSBANK_ENVIRONMENT === "production" &&
    (!process.env.TRANSBANK_COMMERCE_CODE || !process.env.TRANSBANK_API_KEY)
  ) {
    errors.push(
      "Transbank producción requiere TRANSBANK_COMMERCE_CODE y TRANSBANK_API_KEY.",
    );
  }

  if (
    paymentsMode === "production" &&
    process.env.TRANSBANK_ENVIRONMENT !== "production"
  ) {
    errors.push(
      "Con PAYMENTS_MODE=production, TRANSBANK_ENVIRONMENT debe ser 'production'.",
    );
  }

  if (
    paymentsMode === "production" &&
    (process.env.MERCADOPAGO_ACCESS_TOKEN ?? "").startsWith("TEST-")
  ) {
    errors.push(
      "MERCADOPAGO_ACCESS_TOKEN es de prueba; no se puede usar con PAYMENTS_MODE=production.",
    );
  }

  const flowApiKey = process.env.FLOW_API_KEY;
  const flowSecretKey = process.env.FLOW_SECRET_KEY;

  if (flowApiKey || flowSecretKey) {
    if (!flowApiKey || !flowSecretKey) {
      errors.push(
        "Flow requiere FLOW_API_KEY y FLOW_SECRET_KEY configuradas juntas.",
      );
    } else {
      if (
        placeholder(flowApiKey) ||
        flowApiKey.trim().length < 10 ||
        placeholder(flowSecretKey) ||
        flowSecretKey.trim().length < 10
      ) {
        errors.push("FLOW_API_KEY o FLOW_SECRET_KEY parecen placeholders.");
      }
      if (
        paymentsMode === "production" &&
        process.env.FLOW_ENVIRONMENT !== "production"
      ) {
        errors.push(
          "Con PAYMENTS_MODE=production, FLOW_ENVIRONMENT debe ser 'production'.",
        );
      }
    }

    for (const key of [
      "FLOW_PAYMENT_METHOD",
      "FLOW_PAYMENT_METHOD_WEBPAY",
      "FLOW_PAYMENT_METHOD_MACH",
    ]) {
      const value = process.env[key];
      if (value && !/^\d+$/.test(value)) {
        errors.push(
          `${key} debe ser el identificador numérico de Flow (ej: 1, 2, 9).`,
        );
      }
    }
  }

  if (process.env.TRUST_PROXY !== "1") {
    errors.push(
      "TRUST_PROXY debe ser '1' en producción: sin él el rate limit usa la IP del proxy y no la del cliente.",
    );
  }

  if (
    placeholder(process.env.RESEND_API_KEY) ||
    !(process.env.RESEND_API_KEY ?? "").startsWith("re_")
  ) {
    errors.push(
      "RESEND_API_KEY debe ser una API key real de Resend (empieza con re_).",
    );
  }
  if (
    placeholder(process.env.EMAIL_FROM) ||
    !(process.env.EMAIL_FROM ?? "").includes("@")
  ) {
    errors.push("EMAIL_FROM debe ser un remitente real con @.");
  }

  if (
    !process.env.DATABASE_URL &&
    (placeholder(process.env.POSTGRES_PASSWORD) ||
      (process.env.POSTGRES_PASSWORD ?? "").length < 16)
  ) {
    errors.push(
      "POSTGRES_PASSWORD debe ser aleatoria y tener al menos 16 caracteres (o define DATABASE_URL).",
    );
  }

  if (
    process.env.MERCADOPAGO_ACCESS_TOKEN &&
    (placeholder(process.env.MERCADOPAGO_ACCESS_TOKEN) ||
      process.env.MERCADOPAGO_ACCESS_TOKEN.length < 20)
  ) {
    errors.push("MERCADOPAGO_ACCESS_TOKEN parece un placeholder.");
  }
  if (
    process.env.TRANSBANK_API_KEY &&
    placeholder(process.env.TRANSBANK_API_KEY)
  ) {
    errors.push("TRANSBANK_API_KEY parece un placeholder.");
  }
  if (
    process.env.TRANSBANK_COMMERCE_CODE &&
    placeholder(process.env.TRANSBANK_COMMERCE_CODE)
  ) {
    errors.push("TRANSBANK_COMMERCE_CODE parece un placeholder.");
  }

  if (!process.env.TWILIO_ACCOUNT_SID) {
    warnings.push(
      "TWILIO_* no está definido: la verificación por SMS no podrá enviarse.",
    );
  }

  if ((process.env.DATABASE_URL ?? "").startsWith("file:")) {
    warnings.push(
      "DATABASE_URL apunta a SQLite. Para producción se recomienda PostgreSQL administrado con backups/PITR.",
    );
  }
}

for (const warning of warnings) console.warn(`[security] ${warning}`);

if (errors.length > 0) {
  console.error(
    `[security] Configuración insegura para producción:\n- ${errors.join("\n- ")}`,
  );
  process.exit(1);
}

console.log("[security] Configuración de entorno OK.");
