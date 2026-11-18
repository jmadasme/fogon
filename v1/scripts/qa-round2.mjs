import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  dumpUi,
  findEditable,
  tap,
  waitForText,
  typeText,
} from "./android-ui.mjs";

const BASE = "http://localhost:3000";
const MOBILE = "http://localhost:8081";
const OUT = "/home/jma/Documents/Proyect/fogon/assets/screenshots/qa-native/round2";
fs.mkdirSync(OUT, { recursive: true });
const ORDER_CODE = process.env.ORDER_CODE ?? "FOG-2HPUSQ";

const db = new PrismaClient();
const order = await db.order.findUnique({ where: { code: ORDER_CODE } });
if (!order) throw new Error(`Pedido ${ORDER_CODE} no existe`);

const browser = await chromium.launch({ headless: true });
const steps = [];
const errors = [];
let merchantPage;
let courierPage;
let adminPage;

function step(name, detail = "") {
  steps.push({ name, detail, at: new Date().toISOString() });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function shot(page, name) {
  if (!page) return;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

function androidShot(name) {
  const buffer = execFileSync(
    "adb",
    ["-s", "85LNW19522001349", "exec-out", "screencap", "-p"],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  fs.writeFileSync(`${OUT}/${name}.png`, buffer);
}

async function webPage(viewport, label) {
  const context = await browser.newContext({ viewport, locale: "es-CL" });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${label}] ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`[${label}] ${error.message}`));
  return page;
}

async function loginDemo(page, role) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(role, "i") }).first().click();
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForTimeout(1000);
}

try {
  // ------------------------------------------------------------
  // 1. Local web acepta y publica el pedido creado en el teléfono
  // ------------------------------------------------------------
  merchantPage = await webPage({ width: 1440, height: 1000 }, "local-web");
  await loginDemo(merchantPage, "Local");
  await merchantPage.waitForURL(/\/merchant/, { timeout: 20000 });
  const card = merchantPage.locator("article").filter({ hasText: ORDER_CODE }).first();
  await card.waitFor({ timeout: 25000 });
  await card.getByRole("button", { name: "Aceptar" }).click();
  await card.getByRole("button", { name: "Empezar preparación" }).waitFor({ timeout: 15000 });
  await card.getByRole("button", { name: "Empezar preparación" }).click();
  await card.getByRole("button", { name: "Marcar listo" }).waitFor({ timeout: 15000 });
  await card.getByRole("button", { name: "Marcar listo" }).click();
  await card.getByRole("button", { name: "Solicitar repartidor" }).waitFor({ timeout: 15000 });
  await card.getByRole("button", { name: "Solicitar repartidor" }).click();
  await card.getByText("Buscando repartidor…").waitFor({ timeout: 15000 });
  step("Local web publicó el pedido nativo", ORDER_CODE);
  await shot(merchantPage, "01-local-publica");

  // ------------------------------------------------------------
  // 2. Repartidor en web móvil
  // ------------------------------------------------------------
  courierPage = await webPage({ width: 390, height: 844 }, "repartidor-mobile");
  await courierPage.goto(MOBILE, { waitUntil: "networkidle" });
  // QA usa courier2 (cuenta libre); el botón demo usa repartidor@fogon.cl,
  // que tiene KYC aprobado pero puede estar ocupado con una entrega del seed.
  await courierPage.getByPlaceholder("tu@email.cl").fill("courier2@fogon.cl");
  await courierPage.getByPlaceholder("••••••••").fill("fogon123");
  await courierPage.getByText("Ingresar").click();
  await courierPage.getByText("PANEL REPARTIDOR").waitFor({ timeout: 20000 });
  await courierPage.waitForTimeout(1500);
  const connect = courierPage.getByText("Conectarme", { exact: true });
  if (await connect.isVisible().catch(() => false)) {
    await connect.click();
    await courierPage.waitForTimeout(1500);
  }
  await courierPage.getByText(ORDER_CODE).first().waitFor({ timeout: 25000 });
  step("Repartidor web ve el pedido", ORDER_CODE);
  await shot(courierPage, "02-repartidor-ve-pedido");

  const orderCard = courierPage
    .getByText(ORDER_CODE)
    .first()
    .locator("xpath=ancestor::div[.//*[contains(text(),'Aceptar pedido')]][1]");
  const accept = (await orderCard.count())
    ? orderCard.getByText("Aceptar pedido")
    : courierPage.getByText("Aceptar pedido").last();
  await accept.click();
  await courierPage.getByText("Entrega activa").waitFor({ timeout: 20000 });
  await courierPage.getByText("Confirmar retiro en local").click();
  await courierPage.getByText("Confirmar entrega").click();
  const pinInput = courierPage.locator('input[inputmode="numeric"]');
  await pinInput.waitFor({ timeout: 10000 });
  await pinInput.fill(order.deliveryPin);
  await courierPage.getByText("Confirmar entrega").last().click();
  await courierPage.getByText("Pedidos disponibles").waitFor({ timeout: 25000 });
  step("Repartidor web entregó con PIN", order.deliveryPin);
  await shot(courierPage, "03-repartidor-entrega");

  // ------------------------------------------------------------
  // 3. Cliente nativo ve entregado y califica
  // ------------------------------------------------------------
  await waitForText("¡Buen provecho!", 25000);
  step("Cliente nativo ve entregado", ORDER_CODE);
  androidShot("04-cliente-entregado");

  const stars = dumpUi().filter((node) =>
    `${node.text} ${node.desc}`.toLowerCase().includes("5 estrellas"),
  );
  assert(stars.length > 0, "No encontré las estrellas de calificación");
  tap(stars[stars.length - 1]);
  await waitForText("Cuéntanos qué tal estuvo", 10000);
  const nodes = dumpUi();
  const input = findEditable(nodes);
  assert(input, "No encontré el campo de comentario");
  tap(input);
  typeText("QA nativa ronda 2: todo correcto.");
  await new Promise((resolve) => setTimeout(resolve, 500));
  await waitForText("Enviar calificación", 10000);
  const send = dumpUi()
    .filter((node) =>
      `${node.text} ${node.desc}`.toLowerCase().includes("enviar calificación"),
    )
    .pop();
  assert(send, "No encontré el botón de enviar calificación");
  tap(send);
  await waitForText("Ya calificaste", 15000);
  step("Cliente nativo calificó", "5 estrellas");
  androidShot("05-cliente-califica");

  // ------------------------------------------------------------
  // 4. Admin verifica
  // ------------------------------------------------------------
  adminPage = await webPage({ width: 1440, height: 1000 }, "admin-web");
  await loginDemo(adminPage, "Admin");
  await adminPage.goto(`${BASE}/admin/orders`, { waitUntil: "domcontentloaded" });
  await adminPage.locator('input[name="q"]').fill(ORDER_CODE);
  await adminPage.getByRole("button", { name: "Filtrar" }).click();
  await adminPage.waitForTimeout(1500);
  const row = adminPage.locator("tr").filter({ hasText: ORDER_CODE }).first();
  await row.waitFor({ timeout: 15000 });
  const text = await row.innerText();
  assert(text.includes("Entregado"), "Admin no muestra Entregado");
  assert(text.includes("Pagado"), "Admin no muestra Pagado");
  step("Admin verificó el pedido", ORDER_CODE);
  await shot(adminPage, "06-admin-pedido");

  fs.writeFileSync(
    "/tmp/opencode/qa-native-round2.json",
    JSON.stringify({ ok: true, round: 2, orderCode: ORDER_CODE, steps, errors }, null, 2),
  );
  console.log("\nQA nativa ronda 2 completada:", ORDER_CODE);
  console.log("Errores de consola:", errors.length);
} catch (error) {
  fs.writeFileSync(
    "/tmp/opencode/qa-native-round2.json",
    JSON.stringify({ ok: false, round: 2, orderCode: ORDER_CODE, error: error.message, steps, errors }, null, 2),
  );
  console.error("\nQA nativa ronda 2 FALLÓ:", error.message);
  await shot(merchantPage, "99-fallo-local");
  await shot(courierPage, "99-fallo-repartidor");
  await shot(adminPage, "99-fallo-admin");
  try {
    androidShot("99-fallo-android");
  } catch {}
} finally {
  await browser.close();
  await db.$disconnect();
}
