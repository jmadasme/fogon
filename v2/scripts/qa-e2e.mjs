import { firefox } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const SUFFIX = Date.now().toString().slice(-5);
const PASSWORD = "fogon123";
const STORE_NAME = `Sofía Cocina ${SUFFIX}`;
const MERCHANT_EMAIL = `sofia.${SUFFIX}@fogon.cl`;
const COURIER_NAME = `Ángel QA ${SUFFIX}`;
const COURIER_EMAIL = `angel.${SUFFIX}@fogon.cl`;
const OUT = `/home/jma/Documents/Proyect/fogon/assets/screenshots/qa-e2e/${SUFFIX}`;
fs.mkdirSync(OUT, { recursive: true });

const steps = [];
const consoleErrors = [];
const pageErrors = [];
let lastPage = null;

function step(name, detail = "") {
  const entry = { name, detail, at: new Date().toISOString() };
  steps.push(entry);
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function shot(page, name) {
  lastPage = page;
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function newContext() {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: "es-CL",
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { context, page };
}

async function loginDemo(page, role) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(role, "i") }).first().click();
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForTimeout(1000);
}

async function ensureCourierOnline(page) {
  const disconnect = page.getByText(/Desconectarme/).first();
  if (await disconnect.isVisible().catch(() => false)) return;
  const connect = page.getByRole("button", { name: /Conectarme/ }).first();
  await connect.waitFor({ timeout: 10000 });
  await connect.click();
  await disconnect.waitFor({ timeout: 10000 });
}

async function loginCredentials(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForTimeout(1000);
}

const browser = await firefox.launch({ headless: true });

try {
  // ------------------------------------------------------------
  // 1. Crear cocina
  // ------------------------------------------------------------
  const merchant = await newContext();
  const merchantPage = merchant.page;
  await merchantPage.goto(`${BASE}/registro/local`, { waitUntil: "networkidle" });
  await merchantPage.locator("#name").fill("Sofía Morales");
  await merchantPage.locator("#phone").fill(`+56 9 6${SUFFIX}12`);
  await merchantPage.locator("#email").fill(MERCHANT_EMAIL);
  await merchantPage.locator("#password").fill(PASSWORD);
  await merchantPage.locator("#storeName").fill(STORE_NAME);
  await merchantPage.locator("#comuna").selectOption("Providencia");
  await merchantPage.locator("#cuisine").selectOption("Chilena");
  await merchantPage.locator("#address").fill("Av. Providencia 1234");
  await merchantPage.getByRole("button", { name: /Registrar mi cocina/ }).click();
  await merchantPage.waitForURL(/\/merchant/, { timeout: 20000 });
  await merchantPage.getByText(STORE_NAME).first().waitFor({ timeout: 10000 });
  step("Cocina registrada", STORE_NAME);
  await shot(merchantPage, "01-local-registrado");

  // ------------------------------------------------------------
  // 2. Cargar menú
  // ------------------------------------------------------------
  async function addMenuItem(category, item) {
    const details = merchantPage
      .locator("details")
      .filter({ hasText: `Agregar plato a ${category}` })
      .first();
    await details.evaluate((element) => {
      if (element instanceof HTMLDetailsElement) element.open = true;
    });
    await merchantPage.waitForTimeout(250);
    await details.locator('input[name="name"]').fill(item.name);
    await details.locator('input[name="price"]').fill(String(item.price));
    await details.locator('input[name="description"]').fill(item.description);
    await details.locator('input[name="emoji"]').fill(item.emoji);
    await details.getByRole("button", { name: /Agregar al menú/ }).click();
    await merchantPage.waitForTimeout(1400);
    await merchantPage.getByText(item.name).first().waitFor({ timeout: 10000 });
    step("Plato agregado", `${item.name} · $${item.price}`);
  }

  await merchantPage.goto(`${BASE}/merchant/menu`, { waitUntil: "networkidle" });
  await addMenuItem("Recomendados", {
    name: "Empanada de queso QA",
    price: 3500,
    description: "Empanada frita, queso derretido y masa casera.",
    emoji: "🥟",
  });
  await addMenuItem("Recomendados", {
    name: "Pastel de choclo QA",
    price: 8500,
    description: "Choclo cremoso, pino de carne y gratinado.",
    emoji: "🌽",
  });
  await addMenuItem("Bebidas", {
    name: "Jugo natural QA",
    price: 2500,
    description: "Jugo de frutilla natural, sin azúcar añadida.",
    emoji: "🧃",
  });
  await shot(merchantPage, "02-menu-cargado");

  // ------------------------------------------------------------
  // 3. Registrar repartidor nuevo
  // ------------------------------------------------------------
  const courierRegistration = await newContext();
  const courierRegistrationPage = courierRegistration.page;
  await courierRegistrationPage.goto(`${BASE}/registro/repartidor`, {
    waitUntil: "networkidle",
  });
  await courierRegistrationPage.locator("#name").fill(COURIER_NAME);
  await courierRegistrationPage.locator("#email").fill(COURIER_EMAIL);
  await courierRegistrationPage.locator("#phone").fill(`+56 9 7${SUFFIX}34`);
  await courierRegistrationPage.locator("#password").fill(PASSWORD);
  await courierRegistrationPage.locator("#vehicle").selectOption("MOTORCYCLE");
  await courierRegistrationPage.locator("#zone").selectOption("Ñuñoa");
  await courierRegistrationPage.getByRole("button", { name: /Quiero repartir/ }).click();
  await courierRegistrationPage.waitForURL(/\/courier/, { timeout: 20000 });
  await courierRegistrationPage
    .getByText("Cuenta en revisión")
    .waitFor({ timeout: 10000 });
  step("Repartidor registrado y en revisión", COURIER_NAME);
  await shot(courierRegistrationPage, "03-repartidor-registrado");

  // ------------------------------------------------------------
  // 4. Admin verifica cocina y repartidor
  // ------------------------------------------------------------
  const admin = await newContext();
  const adminPage = admin.page;
  await loginDemo(adminPage, "Admin");
  await adminPage.goto(`${BASE}/admin/merchants`, { waitUntil: "networkidle" });
  const merchantRow = adminPage.locator("tr").filter({ hasText: STORE_NAME }).first();
  await merchantRow.waitFor({ timeout: 15000 });
  const verifyMerchant = merchantRow.getByRole("button", { name: "Verificar" });
  if (await verifyMerchant.isVisible().catch(() => false)) {
    await verifyMerchant.click();
    await adminPage.waitForTimeout(1600);
  }
  await merchantRow.getByText("Verificado").first().waitFor({ timeout: 10000 });
  step("Admin verificó la cocina", STORE_NAME);
  await shot(adminPage, "03-admin-locales");

  await adminPage.goto(`${BASE}/admin/couriers`, { waitUntil: "networkidle" });
  const courierRow = adminPage.locator("tr").filter({ hasText: COURIER_NAME }).first();
  await courierRow.waitFor({ timeout: 15000 });
  const verifyCourier = courierRow.getByRole("button", { name: "Verificar" });
  if (await verifyCourier.isVisible().catch(() => false)) {
    await verifyCourier.click();
    await adminPage.waitForTimeout(1600);
  }
  await courierRow.getByText("Verificado").first().waitFor({ timeout: 10000 });
  step("Admin verificó al repartidor", COURIER_NAME);
  await shot(adminPage, "04-admin-repartidores");

  // ------------------------------------------------------------
  // 4. Repartidores se conectan
  // ------------------------------------------------------------
  const courierA = await newContext();
  const courierAPage = courierA.page;
  await loginCredentials(courierAPage, COURIER_EMAIL, PASSWORD);
  await courierAPage.waitForURL(/\/courier/, { timeout: 15000 });
  assert(
    !(await courierAPage.getByText("Cuenta en revisión").isVisible().catch(() => false)),
    "El repartidor nuevo sigue en revisión",
  );
  await ensureCourierOnline(courierAPage);
  step("Repartidor A conectado", COURIER_NAME);
  await shot(courierAPage, "05-repartidor-a-conectado");

  const courierB = await newContext();
  const courierBPage = courierB.page;
  await loginCredentials(courierBPage, "courier3@fogon.cl", PASSWORD);
  await courierBPage.waitForURL(/\/courier/, { timeout: 15000 });
  await ensureCourierOnline(courierBPage);
  step("Repartidor B conectado", "courier3@fogon.cl");
  await shot(courierBPage, "06-repartidor-b-conectado");

  // ------------------------------------------------------------
  // 5. Cliente busca la cocina y hace el pedido
  // ------------------------------------------------------------
  const customer = await newContext();
  const customerPage = customer.page;
  await loginDemo(customerPage, "Cliente");
  await customerPage.waitForURL(`${BASE}/`);

  const search = customerPage.locator('input[name="q"]').first();
  await search.fill(STORE_NAME);
  await search.press("Enter");
  await customerPage.waitForTimeout(1500);
  const storeLink = customerPage
    .locator('a[href^="/store/"]')
    .filter({ hasText: STORE_NAME })
    .first();
  await storeLink.waitFor({ timeout: 10000 });
  await storeLink.click();
  await customerPage.waitForURL(/\/store\//, { timeout: 15000 });
  const storeUrl = customerPage.url();
  step("Cliente encontró la cocina", storeUrl);

  async function addStoreItem(name) {
    await customerPage.waitForTimeout(900);
    const card = customerPage.locator("article").filter({ hasText: name }).first();
    await card.waitFor({ timeout: 10000 });
    await card.getByRole("button", { name: "Agregar", exact: true }).click();
    const modalAdd = customerPage.getByRole("button", { name: /Agregar al carrito/ });
    if (await modalAdd.isVisible().catch(() => false)) {
      await modalAdd.click();
    }
    await customerPage.waitForTimeout(900);
    step("Cliente agregó al carrito", name);
  }

  await addStoreItem("Empanada de queso QA");
  await addStoreItem("Jugo natural QA");
  await shot(customerPage, "07-cliente-local");

  await customerPage.getByRole("button", { name: "Abrir carrito" }).click();
  await customerPage.getByRole("link", { name: "Ir a pagar" }).waitFor({ timeout: 10000 });
  await customerPage.getByRole("link", { name: "Ir a pagar" }).click();
  await customerPage.waitForURL(/\/checkout/, { timeout: 15000 });

  const address = customerPage.locator("#address");
  if (!(await address.inputValue())) {
    await address.fill("Av. Irarrázaval 1234, depto 56");
  }
  const phone = customerPage.locator("#phone");
  if (!(await phone.inputValue())) {
    await phone.fill("+56 9 1111 2222");
  }
  await customerPage.getByRole("button", { name: /Efectivo al recibir/ }).click();
  await customerPage.getByRole("button", { name: "Sin propina" }).click();
  await shot(customerPage, "08-checkout");
  await customerPage.getByRole("button", { name: /Pagar/ }).click();
  await customerPage.waitForURL(/\/order\//, { timeout: 20000 });
  await customerPage.waitForTimeout(1200);

  const codeText = await customerPage.getByText(/FOG-[A-Z0-9]{6}/).first().innerText();
  const orderCode = codeText.match(/FOG-[A-Z0-9]{6}/)[0];
  step("Pedido creado", orderCode);
  await shot(customerPage, "09-pedido-cliente");

  // ------------------------------------------------------------
  // 6. Cocina recibe, acepta, prepara y publica al reparto
  // ------------------------------------------------------------
  await merchantPage.goto(`${BASE}/merchant`, { waitUntil: "domcontentloaded" });
  const merchantCard = merchantPage.locator("article").filter({ hasText: orderCode }).first();
  await merchantCard.waitFor({ timeout: 25000 });
  step("Cocina recibió el pedido", orderCode);
  await shot(merchantPage, "10-cocina-recibe");

  await merchantCard.getByRole("button", { name: "Aceptar" }).click();
  await merchantCard
    .getByRole("button", { name: "Empezar preparación" })
    .waitFor({ timeout: 15000 });
  step("Cocina aceptó el pedido", orderCode);

  await merchantCard.getByRole("button", { name: "Empezar preparación" }).click();
  await merchantCard
    .getByRole("button", { name: "Marcar listo" })
    .waitFor({ timeout: 15000 });
  step("Cocina empezó la preparación", orderCode);

  await merchantCard.getByRole("button", { name: "Marcar listo" }).click();
  await merchantCard
    .getByRole("button", { name: "Solicitar repartidor" })
    .waitFor({ timeout: 15000 });
  step("Pedido listo", orderCode);

  await merchantCard.getByRole("button", { name: "Solicitar repartidor" }).click();
  await merchantCard.getByText("Buscando repartidor…").waitFor({ timeout: 15000 });
  step("Pedido publicado a repartidores", orderCode);
  await shot(merchantPage, "11-cocina-publica");

  // ------------------------------------------------------------
  // 7. Repartidores ven la publicación; el más cercano acepta
  // ------------------------------------------------------------
  await courierAPage.goto(`${BASE}/courier`, { waitUntil: "domcontentloaded" });
  const cardA = courierAPage.locator("article").filter({ hasText: orderCode }).first();
  await cardA.waitFor({ timeout: 25000 });
  const distanceAText = await cardA.getByTestId("courier-distance").innerText();
  const distanceA = Number.parseFloat(distanceAText);
  step("Repartidor A ve el pedido", `${distanceAText}`);
  await shot(courierAPage, "12-repartidor-a-ve-pedido");

  await courierBPage.goto(`${BASE}/courier`, { waitUntil: "domcontentloaded" });
  const cardB = courierBPage.locator("article").filter({ hasText: orderCode }).first();
  await cardB.waitFor({ timeout: 25000 });
  const distanceBText = await cardB.getByTestId("courier-distance").innerText();
  const distanceB = Number.parseFloat(distanceBText);
  step("Repartidor B ve el pedido", `${distanceBText}`);
  await shot(courierBPage, "13-repartidor-b-ve-pedido");

  assert(
    Number.isFinite(distanceA) && Number.isFinite(distanceB),
    "No se pudieron leer las distancias de los repartidores",
  );
  assert(
    distanceA < distanceB,
    `El repartidor A debería estar más cerca (${distanceA} km vs ${distanceB} km)`,
  );
  step("El más cercano es A", `${distanceA} km < ${distanceB} km`);

  await cardA.getByRole("button", { name: "Aceptar pedido" }).click();
  await courierAPage.getByText("Entrega activa").waitFor({ timeout: 20000 });
  await courierAPage
    .getByRole("button", { name: "Confirmar retiro en local" })
    .waitFor({ timeout: 15000 });
  step("Repartidor A ganó el pedido", orderCode);
  await shot(courierAPage, "14-repartidor-a-gana");

  await courierBPage.waitForTimeout(7000);
  let stillVisible = await courierBPage
    .locator("article")
    .filter({ hasText: orderCode })
    .count();
  if (stillVisible > 0) {
    await courierBPage.waitForTimeout(6000);
    stillVisible = await courierBPage
      .locator("article")
      .filter({ hasText: orderCode })
      .count();
  }
  assert(stillVisible === 0, "El pedido aceptado por A sigue visible para B");
  step("El pedido desapareció para B", "primero en aceptar gana");
  await shot(courierBPage, "15-repartidor-b-sin-pedido");

  // ------------------------------------------------------------
  // 8. Entrega con PIN
  // ------------------------------------------------------------
  await courierAPage.getByRole("button", { name: "Confirmar retiro en local" }).click();
  await courierAPage
    .getByRole("button", { name: "Confirmar entrega" })
    .waitFor({ timeout: 15000 });
  step("Repartidor A retiró el pedido", orderCode);

  await customerPage.getByTestId("delivery-pin").waitFor({ timeout: 25000 });
  const pin = (await customerPage.getByTestId("delivery-pin-digit").allTextContents()).join("");
  assert(pin.length === 4, `PIN inválido: ${pin}`);
  step("Cliente ve el PIN de entrega", pin);
  await shot(customerPage, "16-cliente-pin");

  await courierAPage.getByRole("button", { name: "Confirmar entrega" }).last().click();
  await courierAPage.locator('input[inputmode="numeric"]').fill(pin);
  await courierAPage.getByRole("button", { name: "Confirmar entrega" }).last().click();
  await courierAPage.getByText("Pedidos disponibles").waitFor({ timeout: 25000 });
  step("Repartidor A entregó el pedido", orderCode);
  await shot(courierAPage, "17-repartidor-a-entrega");

  await customerPage
    .locator("h1")
    .filter({ hasText: "¡Buen provecho!" })
    .waitFor({ timeout: 25000 });
  step("Cliente ve el pedido entregado", orderCode);
  await shot(customerPage, "18-cliente-entregado");

  // ------------------------------------------------------------
  // 9. Calificación
  // ------------------------------------------------------------
  await customerPage.getByRole("button", { name: "5 estrellas" }).click();
  await customerPage
    .locator("textarea")
    .fill("QA: comida rica, entrega rápida y repartidor muy amable.");
  await customerPage.getByRole("button", { name: "Enviar calificación" }).click();
  await customerPage.getByText("Ya calificaste este pedido").waitFor({ timeout: 15000 });
  step("Cliente calificó el pedido", "5 estrellas");
  await shot(customerPage, "19-cliente-califica");

  // ------------------------------------------------------------
  // 10. Verificación de páginas post-operación
  // ------------------------------------------------------------
  await customerPage.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded" });
  await customerPage.getByText(orderCode).first().waitFor({ timeout: 15000 });
  step("Historial del cliente muestra el pedido", orderCode);
  await shot(customerPage, "20-cliente-historial");

  await merchantPage.goto(`${BASE}/merchant/analytics`, { waitUntil: "domcontentloaded" });
  await merchantPage.getByText("Últimos 30 días").waitFor({ timeout: 15000 });
  step("Analítica del local carga", "30 días");
  await shot(merchantPage, "21-local-analitica");

  await courierAPage.goto(`${BASE}/courier/earnings`, { waitUntil: "domcontentloaded" });
  await courierAPage.getByText(orderCode).first().waitFor({ timeout: 15000 });
  step("Ganancias del repartidor incluyen el pedido", orderCode);
  await shot(courierAPage, "22-repartidor-ganancias");

  await adminPage.goto(`${BASE}/admin/orders`, { waitUntil: "domcontentloaded" });
  await adminPage.locator('input[name="q"]').fill(orderCode);
  await adminPage.getByRole("button", { name: "Filtrar" }).click();
  await adminPage.waitForTimeout(1500);
  const adminRow = adminPage.locator("tr").filter({ hasText: orderCode }).first();
  await adminRow.waitFor({ timeout: 15000 });
  assert(
    (await adminRow.innerText()).includes("Entregado"),
    "El pedido no aparece como Entregado en admin",
  );
  assert(
    (await adminRow.innerText()).includes("Pagado"),
    "El pago en efectivo no quedó como Pagado en admin",
  );
  step("Admin ve el pedido entregado y pagado", orderCode);
  await shot(adminPage, "23-admin-pedido");

  await adminPage.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await adminPage.getByText("Operación de Santiago").waitFor({ timeout: 15000 });
  step("Dashboard admin carga", "métricas actualizadas");
  await shot(adminPage, "24-admin-resumen");

  // ------------------------------------------------------------
  // 11. Cancelación por cliente
  // ------------------------------------------------------------
  await customerPage.goto(storeUrl, { waitUntil: "domcontentloaded" });
  await customerPage.waitForTimeout(1800);
  await addStoreItem("Empanada de queso QA");
  await customerPage.getByRole("button", { name: "Abrir carrito" }).click();
  await customerPage.getByRole("link", { name: "Ir a pagar" }).waitFor({ timeout: 10000 });
  await customerPage.getByRole("link", { name: "Ir a pagar" }).click();
  await customerPage.waitForURL(/\/checkout/, { timeout: 15000 });
  await customerPage.getByRole("button", { name: /Efectivo al recibir/ }).click();
  await customerPage.getByRole("button", { name: "Sin propina" }).click();
  await customerPage.getByRole("button", { name: /Pagar/ }).click();
  await customerPage.waitForURL(/\/order\//, { timeout: 20000 });
  await customerPage.waitForTimeout(1000);
  const cancelCodeText = await customerPage.getByText(/FOG-[A-Z0-9]{6}/).first().innerText();
  const cancelCode = cancelCodeText.match(/FOG-[A-Z0-9]{6}/)[0];
  step("Segundo pedido creado para cancelar", cancelCode);

  customerPage.once("dialog", (dialog) => dialog.accept());
  await customerPage.getByRole("button", { name: "Cancelar pedido" }).click();
  await customerPage.getByText(/Pedido cancelado/).first().waitFor({ timeout: 15000 });
  await customerPage.getByText(/Cancelado por cliente/).first().waitFor({ timeout: 15000 });
  step("Cliente canceló el pedido", cancelCode);
  await shot(customerPage, "25-cliente-cancela");

  await adminPage.goto(`${BASE}/admin/orders`, { waitUntil: "domcontentloaded" });
  await adminPage.locator('input[name="q"]').fill(cancelCode);
  await adminPage.getByRole("button", { name: "Filtrar" }).click();
  await adminPage.waitForTimeout(1500);
  const cancelRow = adminPage.locator("tr").filter({ hasText: cancelCode }).first();
  await cancelRow.waitFor({ timeout: 15000 });
  assert(
    (await cancelRow.innerText()).includes("Cancelado por cliente"),
    "Admin no refleja la cancelación",
  );
  step("Admin ve la cancelación", cancelCode);
  await shot(adminPage, "26-admin-cancelacion");

  // ------------------------------------------------------------
  // 12. Cierre
  // ------------------------------------------------------------
  const report = {
    ok: true,
    suffix: SUFFIX,
    storeName: STORE_NAME,
    merchantEmail: MERCHANT_EMAIL,
    courierName: COURIER_NAME,
    courierEmail: COURIER_EMAIL,
    orderCode,
    cancellationCode: cancelCode,
    distances: { courierA: distanceA, courierB: distanceB },
    steps,
    consoleErrors,
    pageErrors,
    screenshots: OUT,
  };
  fs.writeFileSync(`/tmp/opencode/qa-e2e-${SUFFIX}.json`, JSON.stringify(report, null, 2));
  console.log("\nQA E2E completado.");
  console.log(`Pedido: ${orderCode} · Cancelación: ${cancelCode}`);
  console.log(`Distancias: A=${distanceA} km · B=${distanceB} km`);
  console.log(`Errores de consola: ${consoleErrors.length} · pageerrors: ${pageErrors.length}`);
  console.log(`Reporte: /tmp/opencode/qa-e2e-${SUFFIX}.json`);
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 10));
  if (pageErrors.length) console.log(pageErrors.slice(0, 10));
} catch (error) {
  const report = {
    ok: false,
    suffix: SUFFIX,
    storeName: STORE_NAME,
    merchantEmail: MERCHANT_EMAIL,
    courierName: COURIER_NAME,
    courierEmail: COURIER_EMAIL,
    error: error.message,
    steps,
    consoleErrors,
    pageErrors,
    screenshots: OUT,
  };
  fs.writeFileSync(`/tmp/opencode/qa-e2e-${SUFFIX}.json`, JSON.stringify(report, null, 2));
  if (lastPage) {
    await lastPage
      .screenshot({ path: `${OUT}/99-fallo.png`, fullPage: false })
      .catch(() => {});
  }
  console.error("\nQA E2E FALLÓ:");
  console.error(error.message);
  console.error(`Reporte: /tmp/opencode/qa-e2e-${SUFFIX}.json`);
} finally {
  await browser.close();
}
