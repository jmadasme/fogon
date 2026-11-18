const MIN_SECRET_LENGTH = 32;

function isWeak(value: string | undefined) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length < MIN_SECRET_LENGTH ||
    normalized === "change-me" ||
    normalized === "changeme" ||
    normalized === "secret" ||
    normalized === "password"
  );
}

function isPlaceholder(value: string | undefined) {
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

export function validateRuntimeEnv() {
  const production = process.env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isWeak(process.env.AUTH_SECRET)) {
    const message =
      "AUTH_SECRET debe ser aleatorio y tener al menos 32 caracteres.";
    if (production) errors.push(message);
    else warnings.push(message);
  }

  if (isWeak(process.env.CRON_SECRET)) {
    const message =
      "CRON_SECRET debe ser aleatorio y tener al menos 32 caracteres.";
    if (production) errors.push(message);
    else warnings.push(message);
  }

  if (production) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    if (!appUrl.startsWith("https://")) {
      errors.push("NEXT_PUBLIC_APP_URL debe usar HTTPS en producción.");
    }

    const paymentsMode = process.env.PAYMENTS_MODE ?? "mock";
    if (!["production", "sandbox"].includes(paymentsMode)) {
      errors.push(
        "PAYMENTS_MODE debe ser 'production' o 'sandbox' en producción (no 'mock').",
      );
    }

    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      errors.push("NEXT_PUBLIC_DEMO_MODE debe estar desactivado en producción.");
    }

    if (process.env.MFA_ENFORCED !== "true") {
      errors.push(
        "MFA_ENFORCED debe ser 'true' en producción para admin, soporte y locales.",
      );
    }

    if (isWeak(process.env.MFA_ENCRYPTION_KEY)) {
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
        "KYC_PROVIDER debe ser un proveedor real (por ejemplo Didit) en producción.",
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
        isPlaceholder(process.env.DIDIT_API_KEY) ||
        (process.env.DIDIT_API_KEY ?? "").trim().length < 20
      ) {
        errors.push("DIDIT_API_KEY debe ser una API key real de Didit.");
      }
      if (
        isPlaceholder(process.env.DIDIT_WORKFLOW_ID) ||
        (process.env.DIDIT_WORKFLOW_ID ?? "").trim().length < 8
      ) {
        errors.push("DIDIT_WORKFLOW_ID debe ser el workflow real de Didit.");
      }
      if (isWeak(process.env.DIDIT_WEBHOOK_SECRET)) {
        errors.push(
          "DIDIT_WEBHOOK_SECRET debe ser aleatorio y tener al menos 32 caracteres.",
        );
      }
    } else if (process.env.KYC_PROVIDER !== "mock") {
      if (!process.env.KYC_HOSTED_URL) {
        errors.push("KYC_HOSTED_URL es obligatorio con un proveedor KYC real.");
      }
      if (isWeak(process.env.KYC_WEBHOOK_SECRET)) {
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
          isPlaceholder(flowApiKey) ||
          flowApiKey.trim().length < 10 ||
          isPlaceholder(flowSecretKey) ||
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
        "TRUST_PROXY debe ser '1' en producción para que el rate limit use la IP real del cliente y no la del proxy.",
      );
    }

    if (
      isPlaceholder(process.env.RESEND_API_KEY) ||
      !(process.env.RESEND_API_KEY ?? "").startsWith("re_")
    ) {
      errors.push(
        "RESEND_API_KEY debe ser una API key real de Resend (empieza con re_).",
      );
    }
    if (
      isPlaceholder(process.env.EMAIL_FROM) ||
      !(process.env.EMAIL_FROM ?? "").includes("@")
    ) {
      errors.push("EMAIL_FROM debe ser un remitente real con @.");
    }

    if (
      !process.env.DATABASE_URL &&
      (isPlaceholder(process.env.POSTGRES_PASSWORD) ||
        (process.env.POSTGRES_PASSWORD ?? "").length < 16)
    ) {
      errors.push(
        "POSTGRES_PASSWORD debe ser aleatoria y tener al menos 16 caracteres (o define DATABASE_URL).",
      );
    }

    if (
      process.env.MERCADOPAGO_ACCESS_TOKEN &&
      (isPlaceholder(process.env.MERCADOPAGO_ACCESS_TOKEN) ||
        process.env.MERCADOPAGO_ACCESS_TOKEN.length < 20)
    ) {
      errors.push("MERCADOPAGO_ACCESS_TOKEN parece un placeholder.");
    }
    if (
      process.env.TRANSBANK_API_KEY &&
      isPlaceholder(process.env.TRANSBANK_API_KEY)
    ) {
      errors.push("TRANSBANK_API_KEY parece un placeholder.");
    }
    if (
      process.env.TRANSBANK_COMMERCE_CODE &&
      isPlaceholder(process.env.TRANSBANK_COMMERCE_CODE)
    ) {
      errors.push("TRANSBANK_COMMERCE_CODE parece un placeholder.");
    }

    if (!process.env.TWILIO_ACCOUNT_SID) {
      warnings.push(
        "TWILIO_* no está definido: la verificación por SMS no podrá enviarse.",
      );
    }
  }

  for (const warning of warnings) {
    console.warn(`[security] ${warning}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuración insegura para producción:\n- ${errors.join("\n- ")}`,
    );
  }
}
