import { firefox } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/home/jma/Documents/Proyect/fogon/assets/screenshots/tour-firefox";
const STATUS = "/tmp/opencode/fogon-tour-firefox-status.json";
fs.mkdirSync(OUT, { recursive: true });

const browsers = [];
const results = [];
const errors = [];

async function launchRole(role) {
  const browser = await firefox.launch({
    headless: false,
    args: ["-width", "1440", "-height", "900"],
  });
  browsers.push(browser);
  const context = await browser.newContext({
    viewport: { width: 1400, height: 860 },
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
  return { browser, context, page };
}

async function shot(page, role, name) {
  const path = `${OUT}/${role}-${name}.png`;
  await page.waitForTimeout(900);
  await page.screenshot({ path, fullPage: false });
  results.push({ role, name, url: page.url(), path });
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

// CLIENTE
const customer = await launchRole("Cliente");
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
const ordersPage = await openTab(customer.context, "cliente", "04-pedidos", `${BASE}/orders`);
const orderLinks = ordersPage.locator('a[href^="/order/"]');
const orderCount = await orderLinks.count().catch(() => 0);
let orderHref = null;
for (let index = 0; index < orderCount; index++) {
  const text = await orderLinks.nth(index).innerText().catch(() => "");
  if (!/Cancelado|Reembolsado|Expirado/i.test(text)) {
    orderHref = await orderLinks.nth(index).getAttribute("href").catch(() => null);
    break;
  }
}
if (!orderHref && orderCount > 0) {
  orderHref = await orderLinks.first().getAttribute("href").catch(() => null);
}
if (orderHref) {
  await openTab(customer.context, "cliente", "05-tracking", `${BASE}${orderHref}`);
}

// LOCAL
const merchant = await launchRole("Local");
await shot(merchant.page, "local", "01-panel");
await openTab(merchant.context, "local", "02-menu", `${BASE}/merchant/menu`);
await openTab(merchant.context, "local", "03-analitica", `${BASE}/merchant/analytics`);

// REPARTIDOR
const courier = await launchRole("Repartidor");
await shot(courier.page, "repartidor", "01-panel");
await openTab(courier.context, "repartidor", "02-ganancias", `${BASE}/courier/earnings`);

// ADMIN
const admin = await launchRole("Admin");
await shot(admin.page, "admin", "01-resumen");
await openTab(admin.context, "admin", "02-pedidos", `${BASE}/admin/orders`);
await openTab(admin.context, "admin", "03-locales", `${BASE}/admin/merchants`);
await openTab(admin.context, "admin", "04-repartidores", `${BASE}/admin/couriers`);

fs.writeFileSync(
  STATUS,
  JSON.stringify(
    {
      ok: true,
      browser: "firefox",
      openedAt: new Date().toISOString(),
      base: BASE,
      results,
      errors,
    },
    null,
    2,
  ),
);

console.log(`Firefox: abiertas ${results.length} páginas en 4 ventanas.`);
console.log(`Estado: ${STATUS}`);
if (errors.length) console.log(`Errores de consola: ${errors.length}`);

async function closeAll() {
  await Promise.allSettled(browsers.map((browser) => browser.close()));
  process.exit(0);
}

process.on("SIGTERM", closeAll);
process.on("SIGINT", closeAll);
setInterval(() => {}, 60_000);
