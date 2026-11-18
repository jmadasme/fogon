import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "courier473561@test.cl";
const NAME = "Repartidor Prueba";

const login = await fetch(`${BASE}/api/mobile/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "prueba123" }),
});
const loginData = await login.json();
const token = loginData.token;
const before = await fetch(`${BASE}/api/mobile/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log("before suspend", before.status);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "es-CL" });
const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Admin/i }).first().click();
await page.getByRole("button", { name: "Ingresar", exact: true }).click();
await page.waitForURL(/\/admin/, { timeout: 20000 });
await page.goto(`${BASE}/admin/couriers`, { waitUntil: "domcontentloaded" });
const row = page.locator("tr").filter({ hasText: NAME }).first();
await row.waitFor({ timeout: 15000 });
const suspend = row.getByRole("button", { name: "Suspender" });
if (await suspend.isVisible().catch(() => false)) {
  await suspend.click();
  await page.waitForTimeout(1800);
}
const suspended = await fetch(`${BASE}/api/mobile/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log("after suspend", suspended.status);

const verify = page.locator("tr").filter({ hasText: NAME }).first().getByRole("button", { name: "Verificar" });
if (await verify.isVisible().catch(() => false)) {
  await verify.click();
  await page.waitForTimeout(1800);
}
const oldToken = await fetch(`${BASE}/api/mobile/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log("old token after reactivation", oldToken.status);
const relogin = await fetch(`${BASE}/api/mobile/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "prueba123" }),
});
console.log("new login", relogin.status);
await browser.close();
