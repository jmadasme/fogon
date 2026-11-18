import { chromium } from "playwright";

const BASE = "http://localhost:8081";
const browser = await chromium.launch({ headless: true });
const errors = [];

async function pageFor() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "es-CL",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return page;
}

// Cliente
const customer = await pageFor();
await customer.goto(BASE, { waitUntil: "networkidle" });
await customer.getByText("Cliente demo").click();
await customer.getByText("¿Qué cocinas hoy?").waitFor({ timeout: 20000 });
await customer.getByText("Cocinas cerca").waitFor({ timeout: 20000 });
await customer.waitForTimeout(1800);
await customer.screenshot({ path: "/tmp/opencode/mobile-home.png", fullPage: false });
console.log("cliente home ok");
await customer.getByText("La Cocina de la Abuela").first().click();
await customer.getByText("Recomendados").first().waitFor({ timeout: 15000 });
await customer.screenshot({ path: "/tmp/opencode/mobile-store.png", fullPage: false });
console.log("cliente store ok");
await customer.getByText("Agregar").first().click();
const modalAdd = customer.getByText(/Agregar ·/);
if (await modalAdd.isVisible().catch(() => false)) {
  await modalAdd.click();
}
await customer.getByText("Ir a pagar").last().click();
await customer.getByText("Confirma tu pedido").waitFor({ timeout: 15000 });
await customer.screenshot({ path: "/tmp/opencode/mobile-checkout.png", fullPage: false });
console.log("cliente checkout ok");

// Repartidor
const courier = await pageFor();
await courier.goto(BASE, { waitUntil: "networkidle" });
await courier.getByPlaceholder("tu@email.cl").fill("courier2@fogon.cl");
await courier.getByPlaceholder("••••••••").fill("fogon123");
await courier.getByText("Ingresar").click();
await courier.getByText("PANEL REPARTIDOR").waitFor({ timeout: 20000 });
await courier.waitForTimeout(1500);
await courier.screenshot({ path: "/tmp/opencode/mobile-courier.png", fullPage: false });
console.log("courier route ok");

await browser.close();
console.log("errors", errors.length);
for (const error of errors.slice(0, 15)) console.log("-", error);
