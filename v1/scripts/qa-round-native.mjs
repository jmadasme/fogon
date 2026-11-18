import { chromium } from "playwright";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  dumpUi,
  findByText,
  findEditable,
  tap,
  waitForText,
  typeText,
} from "./android-ui.mjs";

const BASE = "http://localhost:3000";
const MOBILE = "http://localhost:8081";
const OUT = "/home/jma/Documents/Proyect/fogon/assets/screenshots/qa-native/round1";
fs.mkdirSync(OUT, { recursive: true });

const db = new PrismaClient();
const browser = await chromium.launch({ headless: true });
const errors = [];
const steps = [];
let customerPage;
let merchantPage;
let adminPage;

function step(name, detail = "") {
  const entry = { name, detail, at: new Date().toISOString() };
  steps.push(entry);
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
  // 1. Cliente móvil web
  // ------------------------------------------------------------
  customerPage = await webPage({ width: 390, height: 844 }, "cliente-mobile");
  await customerPage.goto(MOBILE, { waitUntil: "networkidle" });
  await customerPage.getByText("Cliente demo").click();
  await customerPage.getByText("¿Qué cocinas hoy?").waitFor({ timeout: 20000 });
  await customerPage.getByText("Cocinas cerca").waitFor({ timeout: 20000 });
  await customerPage.waitForTimeout(1500);

  const search = customerPage.getByPlaceholder("Busca sushi, pizza, comida casera…");
  await search.fill("Pizza Brava");
  await customerPage.waitForTimeout(1500);
  await customerPage.getByText("Pizza Brava").first().click();
  await customerPage.getByText("Recomendados").first().waitFor({ timeout: 15000 });
  step("Cliente móvil abrió Pizza Brava");

  await customerPage.getByText("Agregar").first().click();
  const addButton = customerPage.getByText(/Agregar ·/);
  await addButton.waitFor({ timeout: 10000 });
  await addButton.click();
  await customerPage.waitForTimeout(800);
  await customerPage.getByText("Ir a pagar").last().click();
  await customerPage.getByText("Confirma tu pedido").waitFor({ timeout: 15000 });
  step("Cliente móvil llegó al checkout");
  await shot(customerPage, "01-checkout-mobile");

  const addressInput = customerPage.getByPlaceholder("Av. Irarrázaval 1234, depto 56");
  if (await addressInput.isVisible().catch(() => false)) {
    const value = await addressInput.inputValue();
    if (!value) await addressInput.fill("Av. Irarrázaval 1234, depto 56");
  }
  await customerPage.getByText(/^Pagar \$/).click();
  await customerPage.waitForURL(/\/order\//, { timeout: 25000 });
  await customerPage.waitForTimeout(1200);
  const codeText = await customerPage.getByText(/FOG-[A-Z0-9]{6}/).first().innerText();
  const orderCode = codeText.match(/FOG-[A-Z0-9]{6}/)[0];
  const order = await db.order.findUnique({ where: { code: orderCode } });
  assert(order, "No se creó el pedido");
  step("Pedido móvil creado", orderCode);
  await shot(customerPage, "02-pedido-mobile");

  // ------------------------------------------------------------
  // 2. Local web
  // ------------------------------------------------------------
  merchantPage = await webPage({ width: 1440, height: 1000 }, "local-web");
  await loginDemo(merchantPage, "Local");
  await merchantPage.waitForURL(/\/merchant/, { timeout: 20000 });
  const merchantCard = merchantPage.locator("article").filter({ hasText: orderCode }).first();
  await merchantCard.waitFor({ timeout: 25000 });
  await merchantCard.getByRole("button", { name: "Aceptar" }).click();
  await merchantCard.getByRole("button", { name: "Empezar preparación" }).waitFor({ timeout: 15000 });
  await merchantCard.getByRole("button", { name: "Empezar preparación" }).click();
  await merchantCard.getByRole("button", { name: "Marcar listo" }).waitFor({ timeout: 15000 });
  await merchantCard.getByRole("button", { name: "Marcar listo" }).click();
  await merchantCard.getByRole("button", { name: "Solicitar repartidor" }).waitFor({ timeout: 15000 });
  await merchantCard.getByRole("button", { name: "Solicitar repartidor" }).click();
  await merchantCard.getByText("Buscando repartidor…").waitFor({ timeout: 15000 });
  step("Local web publicó el pedido", orderCode);
  await shot(merchantPage, "03-local-publica");

  // ------------------------------------------------------------
  // 3. Repartidor Huawei nativo
  // ------------------------------------------------------------
  await waitForText("Aceptar pedido", 30000);
  const acceptCard = findByText(dumpUi(), orderCode);
  if (acceptCard) step("Huawei ve el pedido", orderCode);
  await tapTextByText("Aceptar pedido");
  await waitForText("Confirmar retiro en local", 20000);
  step("Huawei aceptó el pedido", orderCode);
  await tapTextByText("Confirmar retiro en local");
  await waitForText("Confirmar entrega", 20000);
  step("Huawei confirmó retiro", orderCode);
  await tapTextByText("Confirmar entrega");
  await waitForText("PIN de entrega", 15000);
  const nodes = dumpUi();
  const input = findEditable(nodes);
  assert(input, "No encontré el campo de PIN");
  tap(input);
  typeText(order.deliveryPin);
  await new Promise((resolve) => setTimeout(resolve, 800));
  const confirmNodes = dumpUi();
  const confirmMatches = confirmNodes.filter(
    (node) =>
      `${node.text} ${node.desc}`.toLowerCase().includes("confirmar entrega") &&
      node.clickable,
  );
  assert(confirmMatches.length > 0, "No encontré el botón de confirmar entrega");
  tap(confirmMatches[confirmMatches.length - 1]);
  await waitForText("Pedidos disponibles", 25000);
  step("Huawei entregó el pedido", orderCode);
  await screenshotAndroid(`${OUT}/04-huawei-entrega.png`);

  // ------------------------------------------------------------
  // 4. Cliente califica
  // ------------------------------------------------------------
  await customerPage.getByText("¡Buen provecho!").first().waitFor({ timeout: 25000 });
  await customerPage.getByLabel("5 estrellas").click();
  await customerPage
    .getByPlaceholder("Cuéntanos qué tal estuvo…")
    .fill("QA nativa: entrega correcta y rápida.");
  await customerPage.getByText("Enviar calificación").click();
  await customerPage.getByText("Ya calificaste este pedido").waitFor({ timeout: 15000 });
  step("Cliente móvil calificó", "5 estrellas");
  await shot(customerPage, "05-cliente-califica");

  // ------------------------------------------------------------
  // 5. Admin verifica
  // ------------------------------------------------------------
  adminPage = await webPage({ width: 1440, height: 1000 }, "admin-web");
  await loginDemo(adminPage, "Admin");
  await adminPage.goto(`${BASE}/admin/orders`, { waitUntil: "domcontentloaded" });
  await adminPage.locator('input[name="q"]').fill(orderCode);
  await adminPage.getByRole("button", { name: "Filtrar" }).click();
  await adminPage.waitForTimeout(1500);
  const adminRow = adminPage.locator("tr").filter({ hasText: orderCode }).first();
  await adminRow.waitFor({ timeout: 15000 });
  const rowText = await adminRow.innerText();
  assert(rowText.includes("Entregado"), "Admin no muestra Entregado");
  assert(rowText.includes("Pagado"), "Admin no muestra Pagado");
  step("Admin verificó pedido entregado y pagado", orderCode);
  await shot(adminPage, "06-admin-pedido");

  const report = {
    ok: true,
    round: 1,
    orderCode,
    steps,
    consoleErrors: errors,
    screenshots: OUT,
  };
  fs.writeFileSync("/tmp/opencode/qa-native-round1.json", JSON.stringify(report, null, 2));
  console.log("\nQA nativa ronda 1 completada:", orderCode);
  console.log("Errores de consola:", errors.length);
} catch (error) {
  const report = {
    ok: false,
    round: 1,
    error: error.message,
    steps,
    consoleErrors: errors,
  };
  fs.writeFileSync("/tmp/opencode/qa-native-round1.json", JSON.stringify(report, null, 2));
  console.error("\nQA nativa ronda 1 FALLÓ:", error.message);
  await shot(customerPage, "99-fallo-cliente");
  await shot(merchantPage, "99-fallo-local");
  await shot(adminPage, "99-fallo-admin");
  await screenshotAndroid(`${OUT}/99-fallo-android.png`).catch(() => {});
} finally {
  await browser.close();
  await db.$disconnect();
}

function tapTextByText(text) {
  const nodes = dumpUi();
  const matches = nodes.filter(
    (node) =>
      `${node.text} ${node.desc}`.toLowerCase().includes(text.toLowerCase()) &&
      node.clickable,
  );
  if (matches.length === 0) throw new Error(`No encontré "${text}" clickable`);
  tap(matches[matches.length - 1]);
}

async function screenshotAndroid(path) {
  const { execFileSync } = await import("node:child_process");
  const buffer = execFileSync(
    "adb",
    ["-s", "85LNW19522001349", "exec-out", "screencap", "-p"],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  fs.writeFileSync(path, buffer);
}
