import "dotenv/config";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const db = new PrismaClient();
const steps = [];

function cookie(email) {
  return execFileSync("node", ["scripts/demo-cookie.mjs", email], {
    encoding: "utf8",
  }).trim();
}

async function api(path, { method = "GET", token, cookieHeader, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

function step(name, detail = "") {
  steps.push({ name, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const customer = await api("/api/mobile/auth/login", {
  method: "POST",
  body: { email: "cliente@fogon.cl", password: "fogon123" },
});
const customerToken = customer.data.token;
const pizzaMerchant = cookie("local@fogon.cl");
const donaMerchant = cookie("local24@fogon.cl");

const pizza = await db.store.findFirst({
  where: { name: "Pizza Brava" },
  include: { categories: { include: { items: { include: { modifiers: { include: { options: true } } } } } } },
});
const dona = await db.store.findFirst({
  where: { name: "Doña Rosa" },
  include: { categories: { include: { items: true } } },
});
const pizzaItems = pizza.categories.flatMap((category) => category.items);
const donaItems = dona.categories.flatMap((category) => category.items);

function pizzaLine(index = 0) {
  const item = pizzaItems[index];
  return {
    itemId: item.id,
    quantity: 1,
    modifierOptionIds: item.modifiers[0] ? [item.modifiers[0].options[0].id] : [],
  };
}

try {
  // PICKUP
  const pickup = await api("/api/orders", {
    method: "POST",
    token: customerToken,
    body: {
      storeId: pizza.id,
      clientRequestId: `edge-pickup-${Date.now()}`,
      items: [pizzaLine(0)],
      deliveryMode: "PICKUP",
      tip: 0,
      paymentProvider: "CASH",
      customerName: "Camila Pérez",
    },
  });
  assert(pickup.status === 200, `pickup create ${pickup.status}`);
  const pickupId = pickup.data.orderId;
  for (const status of ["ACCEPTED", "PREPARING", "READY", "DELIVERED"]) {
    const result = await api(`/api/orders/${pickupId}`, {
      method: "PATCH",
      cookieHeader: pizzaMerchant,
      body: { status },
    });
    assert(result.status === 200, `pickup ${status} -> ${result.status}`);
  }
  const pickupFinal = await api(`/api/orders/${pickupId}`, { token: customerToken });
  assert(pickupFinal.data.status === "DELIVERED", "pickup no entregado");
  step("Pickup completo", pickupFinal.data.code);

  // OWN DELIVERY
  const own = await api("/api/orders", {
    method: "POST",
    token: customerToken,
    body: {
      storeId: dona.id,
      clientRequestId: `edge-own-${Date.now()}`,
      items: [{ itemId: donaItems[2].id, quantity: 1, modifierOptionIds: [] }],
      deliveryMode: "DELIVERY",
      address: { line1: "Av. Bernardo O'Higgins 123", comuna: "Quilicura" },
      tip: 0,
      paymentProvider: "CASH",
      customerName: "Camila Pérez",
    },
  });
  assert(own.status === 200, `own create ${own.status}`);
  const ownId = own.data.orderId;
  for (const status of ["ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"]) {
    const result = await api(`/api/orders/${ownId}`, {
      method: "PATCH",
      cookieHeader: donaMerchant,
      body: { status },
    });
    assert(result.status === 200, `own ${status} -> ${result.status}`);
  }
  const ownFinal = await api(`/api/orders/${ownId}`, { token: customerToken });
  assert(ownFinal.data.status === "DELIVERED", "own no entregado");
  step("Reparto propio completo", ownFinal.data.code);

  // MERCHANT REJECT
  const reject = await api("/api/orders", {
    method: "POST",
    token: customerToken,
    body: {
      storeId: pizza.id,
      clientRequestId: `edge-reject-${Date.now()}`,
      items: [pizzaLine(1)],
      deliveryMode: "PICKUP",
      tip: 0,
      paymentProvider: "CASH",
    },
  });
  const rejectId = reject.data.orderId;
  const rejected = await api(`/api/orders/${rejectId}`, {
    method: "PATCH",
    cookieHeader: pizzaMerchant,
    body: { status: "CANCELLED_BY_MERCHANT", reason: "Sin stock" },
  });
  assert(rejected.status === 200, `reject ${rejected.status}`);
  const rejectFinal = await api(`/api/orders/${rejectId}`, { token: customerToken });
  assert(rejectFinal.data.status === "CANCELLED_BY_MERCHANT", "reject status");
  assert(rejectFinal.data.paymentStatus === "CANCELLED", "reject payment status");
  step("Rechazo de local completo", rejectFinal.data.code);

  // MOCK PAYMENT
  const mock = await api("/api/orders", {
    method: "POST",
    token: customerToken,
    body: {
      storeId: pizza.id,
      clientRequestId: `edge-mock-${Date.now()}`,
      items: [pizzaLine(2)],
      deliveryMode: "PICKUP",
      tip: 0,
      paymentProvider: "MERCADOPAGO",
    },
  });
  assert(mock.status === 200, `mock create ${mock.status}`);
  const mockFinal = await api(`/api/orders/${mock.data.orderId}`, { token: customerToken });
  assert(mockFinal.data.paymentStatus === "PAID", "mock payment not paid");
  step("Pago mock completo", mockFinal.data.code);

  fs.writeFileSync(
    "/tmp/opencode/qa-edge-api.json",
    JSON.stringify({ ok: true, steps }, null, 2),
  );
  console.log("Edge API QA OK");
} catch (error) {
  fs.writeFileSync(
    "/tmp/opencode/qa-edge-api.json",
    JSON.stringify({ ok: false, error: error.message, steps }, null, 2),
  );
  console.error("Edge API QA FALLÓ:", error.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
