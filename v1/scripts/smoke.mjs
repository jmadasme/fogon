import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/tmp/opencode/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function newPage() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "es-CL",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`[console] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error.message}`));
  return { context, page };
}

async function login(page, role) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(role, "i") }).first().click();
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

// Customer flow
const customer = await newPage();
await login(customer.page, "Cliente");
await customer.page.waitForURL(`${BASE}/`, { timeout: 15000 });
await customer.page.screenshot({ path: `${SHOTS}/01-home.png`, fullPage: true });
console.log("customer login ok");

await customer.page.locator('a[href^="/store/"]').first().click();
await customer.page.waitForURL(/\/store\//, { timeout: 15000 });
await customer.page.screenshot({ path: `${SHOTS}/02-store.png`, fullPage: true });
console.log("store page ok:", customer.page.url());

await customer.page.getByRole("button", { name: "Agregar", exact: true }).first().click();
const dialogAdd = customer.page.getByRole("button", { name: /Agregar al carrito/ });
if (await dialogAdd.isVisible().catch(() => false)) {
  await dialogAdd.click();
}
await customer.page.getByRole("button", { name: "Abrir carrito" }).click();
await customer.page.getByRole("link", { name: "Ir a pagar" }).click();
await customer.page.waitForURL(/\/checkout/, { timeout: 15000 });
await customer.page.screenshot({ path: `${SHOTS}/03-checkout.png`, fullPage: true });
console.log("checkout ok");

const address = customer.page.locator("#address");
if (await address.isVisible().catch(() => false)) {
  await address.fill("Av. Irarrázaval 1234, depto 56");
}
const phone = customer.page.locator("#phone");
if (await phone.isVisible().catch(() => false)) {
  await phone.fill("+56 9 1111 2222");
}
await customer.page.getByRole("button", { name: /Pagar/ }).click();
await customer.page.waitForURL(/\/order\//, { timeout: 20000 });
await customer.page.waitForTimeout(1500);
await customer.page.screenshot({ path: `${SHOTS}/04-order.png`, fullPage: true });
console.log("order tracking ok:", customer.page.url());

// Merchant
const merchant = await newPage();
await login(merchant.page, "Local");
await merchant.page.waitForURL(/\/merchant/, { timeout: 15000 });
await merchant.page.screenshot({ path: `${SHOTS}/05-merchant.png`, fullPage: true });
console.log("merchant login ok");

// Courier
const courier = await newPage();
await login(courier.page, "Repartidor");
await courier.page.waitForURL(/\/courier/, { timeout: 15000 });
await courier.page.screenshot({ path: `${SHOTS}/06-courier.png`, fullPage: true });
console.log("courier login ok");

// Admin
const admin = await newPage();
await login(admin.page, "Admin");
await admin.page.waitForURL(/\/admin/, { timeout: 15000 });
await admin.page.screenshot({ path: `${SHOTS}/07-admin.png`, fullPage: true });
console.log("admin login ok");

await browser.close();

if (errors.length > 0) {
  console.log("\nErrores de consola:");
  for (const error of errors) console.log(error);
  process.exit(1);
}
console.log("\nSmoke test OK, sin errores de consola.");
