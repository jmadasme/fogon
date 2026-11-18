import { firefox } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/opencode/fogon-route-audit.json";
const browser = await firefox.launch({ headless: true });
const report = [];
const consoleErrors = [];

async function audit(page, role, name, path) {
  const url = `${BASE}${path}`;
  let status = 0;
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    status = response?.status() ?? 0;
    await page.waitForTimeout(1800);
    const info = await page.evaluate(() => {
      const text = document.body?.innerText ?? "";
      const main = document.querySelector("main")?.innerText ?? "";
      return {
        title: document.title,
        bodyLength: text.trim().length,
        mainLength: main.trim().length,
        errorText:
          /Application error|Unhandled Runtime Error|This page could not be found|Internal Server Error/i.test(
            text,
          ),
        snippet: text.trim().slice(0, 120),
      };
    });
    report.push({ role, name, path, status, ...info });
    if (info.errorText) {
      await page.screenshot({
        path: `/tmp/opencode/audit-${role}-${name}.png`,
        fullPage: true,
      });
    }
  } catch (error) {
    report.push({
      role,
      name,
      path,
      status,
      error: error.message,
      bodyLength: 0,
    });
    await page
      .screenshot({ path: `/tmp/opencode/audit-${role}-${name}.png`, fullPage: true })
      .catch(() => {});
  }
}

async function login(role) {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: "es-CL",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`[${role}] ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`[${role}] ${error.message}`));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(role, "i") }).first().click();
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForTimeout(1000);
  return { context, page };
}

// Público
{
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: "es-CL",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`[público] ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`[público] ${error.message}`));
  for (const [name, path] of [
    ["home", "/"],
    ["para-locales", "/para-locales"],
    ["para-repartidores", "/para-repartidores"],
    ["soporte", "/soporte"],
    ["terminos", "/legal/terminos"],
    ["privacidad", "/legal/privacidad"],
    ["reembolsos", "/legal/reembolsos"],
    ["login", "/login"],
    ["register", "/register"],
    ["registro-local", "/registro/local"],
    ["registro-repartidor", "/registro/repartidor"],
    ["local", "/store/la-cocina-de-la-abuela-santiago"],
  ]) {
    await audit(page, "público", name, path);
  }
  await context.close();
}

// Cliente
{
  const { context, page } = await login("Cliente");
  await audit(page, "cliente", "home", "/");
  await audit(page, "cliente", "local", "/store/la-cocina-de-la-abuela-santiago");
  await page.getByRole("button", { name: "Agregar", exact: true }).first().click();
  const add = page.getByRole("button", { name: /Agregar al carrito/ });
  if (await add.isVisible().catch(() => false)) await add.click();
  await page.waitForTimeout(500);
  await audit(page, "cliente", "checkout", "/checkout");
  await audit(page, "cliente", "pedidos", "/orders");
  const href = await page.locator('a[href^="/order/"]').first().getAttribute("href");
  if (href) await audit(page, "cliente", "tracking", href);
  await context.close();
}

// Local
{
  const { context, page } = await login("Local");
  await audit(page, "local", "panel", "/merchant");
  await audit(page, "local", "menu", "/merchant/menu");
  await audit(page, "local", "analitica", "/merchant/analytics");
  await audit(page, "local", "kyc", "/kyc");
  await audit(page, "local", "seguridad", "/settings/security");
  await context.close();
}

// Repartidor
{
  const { context, page } = await login("Repartidor");
  await audit(page, "repartidor", "panel", "/courier");
  await audit(page, "repartidor", "ganancias", "/courier/earnings");
  await audit(page, "repartidor", "kyc", "/kyc");
  await audit(page, "repartidor", "seguridad", "/settings/security");
  await context.close();
}

// Admin
{
  const { context, page } = await login("Admin");
  await audit(page, "admin", "resumen", "/admin");
  await audit(page, "admin", "pedidos", "/admin/orders");
  await audit(page, "admin", "locales", "/admin/merchants");
  await audit(page, "admin", "repartidores", "/admin/couriers");
  await audit(page, "admin", "kyc", "/admin/kyc");
  await audit(page, "admin", "seguridad", "/settings/security");
  await context.close();
}

// Health
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await audit(page, "api", "health", "/api/health");
  await context.close();
}

await browser.close();
fs.writeFileSync(
  OUT,
  JSON.stringify({ report, consoleErrors }, null, 2),
);

console.log("role".padEnd(12), "page".padEnd(20), "status", "main", "error");
for (const row of report) {
  const isApi = row.path.startsWith("/api/");
  const problem =
    row.status !== 200 ||
    (!isApi && row.mainLength < 50) ||
    row.errorText ||
    row.error;
  console.log(
    String(row.role).padEnd(12),
    String(row.name).padEnd(20),
    String(row.status).padEnd(6),
    String(row.mainLength ?? 0).padEnd(5),
    problem ? "PROBLEMA" : "ok",
  );
  if (row.error) console.log("   ", row.error);
  if (problem && row.snippet) console.log("   ", row.snippet);
}
console.log(`\nConsole errors: ${consoleErrors.length}`);
for (const error of consoleErrors.slice(0, 20)) console.log(" -", error);
console.log(`\nJSON: ${OUT}`);
