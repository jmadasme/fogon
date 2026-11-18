import "dotenv/config";
import {
  DEFAULT_STRICT_WORKFLOW_LABEL,
  buildStrictWorkflowPayload,
} from "./didit-strict-workflow-config.mjs";

const API = "https://verification.didit.me";
const key = process.env.DIDIT_WORKFLOW_API_KEY ?? process.env.DIDIT_API_KEY;
const label =
  process.env.DIDIT_WORKFLOW_LABEL ?? DEFAULT_STRICT_WORKFLOW_LABEL;
const publish = process.env.DIDIT_PUBLISH === "true";
const enableNfc = process.env.DIDIT_ENABLE_NFC === "true";

if (!key) {
  console.error("Falta DIDIT_WORKFLOW_API_KEY o DIDIT_API_KEY en .env.");
  process.exit(1);
}

async function didit(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-api-key": key,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? body.detail
        : body;
    throw new Error(`Didit ${response.status}: ${String(detail).slice(0, 500)}`);
  }
  return body;
}

try {
  const list = await didit("/v3/workflows/?limit=100");
  const existing = Array.isArray(list?.results)
    ? list.results.find((workflow) => workflow.workflow_label === label)
    : null;

  if (existing) {
    console.log(`Ya existe un workflow "${label}": ${existing.workflow_id}`);
    console.log(`Estado: ${existing.status}; versión: ${existing.version}`);
    console.log("Para endurecerlo usa: npm run kyc:harden-workflow");
    process.exit(0);
  }

  const created = await didit("/v3/workflows/", {
    method: "POST",
    body: JSON.stringify(
      buildStrictWorkflowPayload({ publish, enableNfc }),
    ),
  });

  console.log(`Workflow creado: ${created.workflow_id ?? created.uuid}`);
  console.log(`Estado: ${created.status}`);
  console.log(`Features: ${created.features}`);
  console.log(`Precio: USD ${created.total_price}`);
  console.log("");
  console.log("Siguiente paso:");
  if (!publish) {
    console.log(
      "  - Revisa el draft en Didit y publícalo, o vuelve a ejecutar con DIDIT_PUBLISH=true.",
    );
  }
  console.log("  - Actualiza DIDIT_WORKFLOW_ID en .env.");
  console.log(
    "  - Prueba una sesión sandbox antes de activar KYC_REQUIRED=true.",
  );
} catch (error) {
  console.error(`No se pudo crear el workflow: ${error.message}`);
  if (String(error.message).includes("403")) {
    console.error(
      "La API key no tiene permiso workflows:write. Crea una key de gestión con Workflows: Write o usa el panel de Didit.",
    );
  }
  process.exit(1);
}
