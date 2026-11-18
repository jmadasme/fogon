import "dotenv/config";
import {
  DEFAULT_STRICT_WORKFLOW_LABEL,
  buildStrictFeatures,
} from "./didit-strict-workflow-config.mjs";

const API = "https://verification.didit.me";
const key = process.env.DIDIT_WORKFLOW_API_KEY ?? process.env.DIDIT_API_KEY;
const label =
  process.env.DIDIT_WORKFLOW_LABEL ?? DEFAULT_STRICT_WORKFLOW_LABEL;
const enableNfc = process.env.DIDIT_ENABLE_NFC === "true";
const forcePublished = process.env.DIDIT_FORCE_PATCH === "true";

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
  // No usamos DIDIT_WORKFLOW_ID por defecto: ese ID es el que usa la app en
  // runtime y puede apuntar al workflow publicado. Para apuntar a un draft
  // específico, usa DIDIT_TARGET_WORKFLOW_ID.
  let workflowId = process.env.DIDIT_TARGET_WORKFLOW_ID?.trim();

  if (!workflowId) {
    const list = await didit("/v3/workflows/?limit=100");
    const match = Array.isArray(list?.results)
      ? list.results.find((workflow) => workflow.workflow_label === label)
      : null;
    workflowId = match?.workflow_id;
  }

  if (!workflowId) {
    console.error(
      `No encontré el workflow "${label}". Crea uno con npm run kyc:strict-workflow o define DIDIT_TARGET_WORKFLOW_ID.`,
    );
    process.exit(1);
  }

  const current = await didit(`/v3/workflows/${workflowId}/`);
  if (current.status === "published" && !forcePublished) {
    console.error(
      `El workflow ${workflowId} está publicado. Para no cambiar producción, crea un draft nuevo o usa DIDIT_FORCE_PATCH=true si sabes lo que haces.`,
    );
    process.exit(1);
  }

  const updated = await didit(`/v3/workflows/${workflowId}/`, {
    method: "PATCH",
    body: JSON.stringify({
      features: buildStrictFeatures({ enableNfc }),
      is_desktop_allowed: true,
      max_retry_attempts: 2,
      retry_window_days: 7,
      face_liveness_max_attempts: 2,
      face_match_max_attempts: 2,
      session_expiration_time: 3600,
    }),
  });

  console.log(`Workflow endurecido: ${workflowId}`);
  console.log(`Estado: ${updated.status}`);
  console.log(`Features: ${updated.features}`);
  console.log(`Precio: USD ${updated.total_price}`);
  console.log("");
  for (const field of [
    "face_liveness_method",
    "face_liveness_flash_mode",
    "face_liveness_score_decline_threshold",
    "face_liveness_score_review_threshold",
    "frame_injection_action",
    "virtual_camera_action",
    "screen_capture_action",
    "device_emulator_action",
    "device_rooted_action",
    "device_app_tampered_action",
    "device_hooking_action",
    "duplicated_device_action",
    "duplicated_ip_action",
    "duplicated_email_action",
    "duplicated_phone_number_action",
    "vpn_detection_action",
    "face_match_score_decline_threshold",
    "face_match_score_review_threshold",
    "aml_score_approve_threshold",
    "aml_score_review_threshold",
  ]) {
    if (updated[field] !== undefined) console.log(`${field}: ${updated[field]}`);
  }
  console.log("");
  console.log(
    "Revisa el draft, ejecuta Test run y publícalo cuando esté validado.",
  );
} catch (error) {
  console.error(`No se pudo endurecer el workflow: ${error.message}`);
  if (String(error.message).includes("403")) {
    console.error(
      "La API key no tiene permiso workflows:write. Crea una key de gestión con Workflows: Write o usa el panel de Didit.",
    );
  }
  process.exit(1);
}
