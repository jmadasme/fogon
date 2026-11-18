import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const stamp = Date.now().toString().slice(-6);

const browser = await chromium.launch();
const errors = [];

async function newPage() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "es-CL",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[console] ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error.message}`));
  return { context, page };
}

// Customer registration
{
  const { page } = await newPage();
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.locator("#name").fill("Cliente Prueba");
  await page.locator("#email").fill(`cliente${stamp}@test.cl`);
  await page.locator("#phone").fill("+56 9 1234 5678");
  await page.locator("#password").fill("prueba123");
  await page.getByRole("button", { name: /Crear cuenta/ }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  console.log("customer registration ok");
}

// Merchant registration
{
  const { page } = await newPage();
  await page.goto(`${BASE}/registro/local`, { waitUntil: "networkidle" });
  await page.locator("#name").fill("Local Prueba");
  await page.locator("#phone").fill("+56 9 2222 3333");
  await page.locator("#email").fill(`local${stamp}@test.cl`);
  await page.locator("#password").fill("prueba123");
  await page.locator("#storeName").fill(`Cocina Test ${stamp}`);
  await page.locator("#comuna").selectOption("Ñuñoa");
  await page.locator("#cuisine").selectOption("Chilena");
  await page.locator("#address").fill("Av. Prueba 123");
  await page.getByRole("button", { name: /Registrar mi cocina/ }).click();
  await page.waitForURL(/\/merchant/, { timeout: 15000 });
  console.log("merchant registration ok");
}

// Courier registration
{
  const { page } = await newPage();
  await page.goto(`${BASE}/registro/repartidor`, { waitUntil: "networkidle" });
  await page.locator("#name").fill("Repartidor Prueba");
  await page.locator("#email").fill(`courier${stamp}@test.cl`);
  await page.locator("#phone").fill("+56 9 4444 5555");
  await page.locator("#password").fill("prueba123");
  await page.locator("#vehicle").selectOption("MOTORCYCLE");
  await page.locator("#zone").selectOption("Ñuñoa");
  await page.getByRole("button", { name: /Quiero repartir/ }).click();
  await page.waitForURL(/\/courier/, { timeout: 15000 });
  console.log("courier registration ok");
}

await browser.close();

if (errors.length > 0) {
  console.log("\nErrores de consola:");
  for (const error of errors) console.log(error);
  process.exit(1);
}
console.log("\nRegistration smoke OK.");
