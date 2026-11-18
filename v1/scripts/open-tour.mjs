import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/home/jma/Documents/Proyect/fogon/assets/screenshots/tour";
const STATUS = "/tmp/opencode/fogon-tour-status.json";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: ["--window-size=1440,940", "--window-position=40,40"],
});

const results = [];
const errors = [];

async function prepare(role) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: "es-CL",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${role}] ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`[${role}] ${error.message}`));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(role, "i") }).first().click();
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 20000,
  });
  await page.waitForTimeout(1200);
  return { context, page };
}

async function shot(page, role, name) {
  const path = `${OUT}/${role}-${name}.png`;
  await page.waitForTimeout(900);
  await page.screenshot({ path, fullPage: false });
  results.push({ role, name, url: page.url(), path });
  return path;
}

async function openTab(context, role, name, url, action) {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${role}/${name}] ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`[${role}/${name}] ${error.message}`));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  if (action) await action(page);
  await shot(page, role, name);
  return page;
}

// ---------- CLIENTE ----------
const customer = await prepare("Cliente");
await shot(customer.page, "cliente", "01-home");

const storePage = await openTab(
  customer.context,
  "cliente",
  "02-local",
  `${BASE}/store/la-cocina-de-la-abuela-santiago`,
);
await storePage.getByRole("button", { name: "Agregar", exact: true }).first().click();
const addDialog = storePage.getByRole("button", { name: /Agregar al carrito/ });
if (await addDialog.isVisible().catch(() => false)) {
  await addDialog.click();
}
await storePage.waitForTimeout(800);

await openTab(customer.context, "cliente", "03-checkout", `${BASE}/checkout`);
const ordersPage = await openTab(
  customer.context,
  "cliente",
  "04-pedidos",
  `${BASE}/orders`,
);
const orderHref = await ordersPage
  .locator('a[href^="/order/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);
if (orderHref) {
  await openTab(customer.context, "cliente", "05-tracking", `${BASE}${orderHref}`);
}
await customer.page.bringToFront();

// ---------- LOCAL ----------
const merchant = await prepare("Local");
await shot(merchant.page, "local", "01-panel");
await openTab(merchant.context, "local", "02-menu", `${BASE}/merchant/menu`);
await openTab(merchant.context, "local", "03-analitica", `${BASE}/merchant/analytics`);
await merchant.page.bringToFront();

// ---------- REPARTIDOR ----------
const courier = await prepare("Repartidor");
await shot(courier.page, "repartidor", "01-panel");
await openTab(courier.context, "repartidor", "02-ganancias", `${BASE}/courier/earnings`);
await courier.page.bringToFront();

// ---------- ADMIN ----------
const admin = await prepare("Admin");
await shot(admin.page, "admin", "01-resumen");
await openTab(admin.context, "admin", "02-pedidos", `${BASE}/admin/orders`);
await openTab(admin.context, "admin", "03-locales", `${BASE}/admin/merchants`);
await openTab(admin.context, "admin", "04-repartidores", `${BASE}/admin/couriers`);

// Organizar las cuatro ventanas en una grilla 2x2 para verlas todas.
try {
  const screen = await admin.page.evaluate(() => ({
    width: window.screen.availWidth,
    height: window.screen.availHeight,
  }));
  const halfW = Math.floor(screen.width / 2);
  const halfH = Math.floor(screen.height / 2);
  const placements = [
    [customer.page, { left: 0, top: 0 }],
    [merchant.page, { left: halfW, top: 0 }],
    [courier.page, { left: 0, top: halfH }],
    [admin.page, { left: halfW, top: halfH }],
  ];
  for (const [page, position] of placements) {
    const session = await page.context().newCDPSession(page);
    const { windowId } = await session.send("Browser.getWindowForTarget");
    await session.send("Browser.setWindowBounds", {
      windowId,
      bounds: {
        ...position,
        width: halfW,
        height: halfH,
        windowState: "normal",
      },
    });
  }
} catch (error) {
  errors.push(`[tiling] ${error.message}`);
}

await customer.page.bringToFront();

fs.writeFileSync(
  STATUS,
  JSON.stringify(
    {
      ok: true,
      openedAt: new Date().toISOString(),
      base: BASE,
      results,
      errors,
    },
    null,
    2,
  ),
);

console.log(`Abiertas ${results.length} páginas.`);
console.log(`Estado: ${STATUS}`);
if (errors.length) console.log(`Errores de consola: ${errors.length}`);

// Mantener el navegador abierto para que el usuario pueda recorrer las páginas.
setInterval(() => {}, 60_000);
