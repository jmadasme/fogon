import "dotenv/config";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const db = new PrismaClient();
const results = [];
const createdOrderIds = [];

function log(name, detail) {
  results.push({ name, detail });
  console.log(`\n## ${name}\n${detail}`);
}

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

async function login(email, password = "fogon123") {
  const response = await api("/api/mobile/auth/login", {
    method: "POST",
    body: { email, password },
    headers: undefined,
  });
  if (response.status !== 200) throw new Error(`login ${email} -> ${response.status}`);
  return response.data.token;
}

const pizza = await db.store.findFirst({
  where: { name: "Pizza Brava" },
  include: { categories: { include: { items: { include: { modifiers: { include: { options: true } } } } } } },
});
const item = pizza.categories.flatMap((c) => c.items).find((i) => i.name === "Pizza margherita");
const option = item.modifiers[0].options[0];

const courier8 = await db.courier.findFirst({ where: { user: { email: "courier8@fogon.cl" } }, include: { user: true } });
const courier9 = await db.courier.findFirst({ where: { user: { email: "courier9@fogon.cl" } }, include: { user: true } });
const original = [courier8, courier9].map((c) => ({ id: c.id, status: c.status, verificationStatus: c.verificationStatus, lat: c.currentLat, lng: c.currentLng, lastSeenAt: c.lastSeenAt }));

async function prepareCourier(courier) {
  await db.courier.update({
    where: { id: courier.id },
    data: {
      status: "AVAILABLE",
      verificationStatus: "VERIFIED",
      currentLat: pizza.lat,
      currentLng: pizza.lng,
      lastSeenAt: new Date(),
    },
  });
}

async function createOrder(label) {
  const customerToken = await login("cliente@fogon.cl");
  const response = await api("/api/orders", {
    method: "POST",
    token: customerToken,
    body: {
      storeId: pizza.id,
      clientRequestId: `sec-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      items: [{ itemId: item.id, quantity: 1, modifierOptionIds: [option.id] }],
      deliveryMode: "DELIVERY",
      address: { line1: "Av. Principal 123", comuna: "Cerro Navia" },
      tip: 0,
      paymentProvider: "CASH",
      customerName: "Camila Pérez",
    },
  });
  if (response.status !== 200) throw new Error(`create ${label} -> ${response.status} ${JSON.stringify(response.data)}`);
  createdOrderIds.push(response.data.orderId);
  return { customerToken, order: response.data };
}

async function publish(orderId) {
  const merchant = cookie("local@fogon.cl");
  for (const status of ["ACCEPTED", "PREPARING", "READY", "PENDING_COURIER"]) {
    const response = await api(`/api/orders/${orderId}`, {
      method: "PATCH",
      cookieHeader: merchant,
      body: { status },
    });
    if (response.status !== 200) throw new Error(`publish ${status} -> ${response.status}`);
  }
}

try {
  await prepareCourier(courier8);
  await prepareCourier(courier9);
  const token8 = await login(courier8.user.email);
  const token9 = await login(courier9.user.email);

  // ---- 5.2 / 5.3: doble aceptación concurrente ----
  const race = await createOrder("race");
  await publish(race.order.orderId);
  const [accept8, accept9] = await Promise.all([
    api(`/api/orders/${race.order.orderId}`, {
      method: "PATCH",
      token: token8,
      body: { status: "COURIER_ASSIGNED" },
    }),
    api(`/api/orders/${race.order.orderId}`, {
      method: "PATCH",
      token: token9,
      body: { status: "COURIER_ASSIGNED" },
    }),
  ]);
  const raceFinal = await db.order.findUnique({ where: { id: race.order.orderId }, include: { courier: { include: { user: true } } } });
  log("Doble aceptación concurrente", JSON.stringify({
    accept8: { status: accept8.status, error: accept8.data?.error },
    accept9: { status: accept9.status, error: accept9.data?.error },
    finalCourier: raceFinal.courier?.user.email,
    finalStatus: raceFinal.status,
  }, null, 2));

  // ---- 5.5: fuerza bruta de PIN ----
  const winnerToken = raceFinal.courier?.userId === courier8.userId ? token8 : token9;
  if (raceFinal.courier) {
    await api(`/api/orders/${race.order.orderId}`, {
      method: "PATCH",
      token: winnerToken,
      body: { status: "PICKED_UP" },
    });
    const attempts = [];
    for (let i = 0; i < 12; i += 1) {
      const pin = String(1000 + i);
      const response = await api(`/api/orders/${race.order.orderId}`, {
        method: "PATCH",
        token: winnerToken,
        body: { status: "DELIVERED", pin },
      });
      attempts.push(response.status);
    }
    log("Fuerza bruta de PIN (12 intentos)", JSON.stringify({
      statuses: attempts,
      blocked: attempts.includes(429) || attempts.includes(423),
      finalStatus: (await db.order.findUnique({ where: { id: race.order.orderId } }))?.status,
    }, null, 2));
    await api(`/api/orders/${race.order.orderId}`, {
      method: "PATCH",
      token: winnerToken,
      body: { status: "DELIVERED", pin: raceFinal.deliveryPin },
    });
  }

  // ---- 5.4: fuga de dirección a repartidores antes de aceptar ----
  const leak = await createOrder("leak");
  await publish(leak.order.orderId);
  const dashboard = await api("/api/courier", { token: token8 });
  const available = (dashboard.data?.available ?? []).find((o) => o.id === leak.order.orderId);
  log("Datos visibles para repartidor antes de aceptar", JSON.stringify({
    addressLine: available?.addressLine,
    lat: available?.lat,
    lng: available?.lng,
    instructions: available?.instructions,
    customer: available?.customer,
    items: available?.items?.map((i) => i.name),
  }, null, 2));

  // ---- 5.7: ubicación del repartidor después de entregar ----
  const delivered = await db.order.findFirst({
    where: { code: "FOG-X4982B" },
    include: { courier: true },
  });
  const customerToken = await login("cliente@fogon.cl");
  const deliveredView = await api(`/api/orders/${delivered.id}`, { token: customerToken });
  log("Ubicación/teléfono del repartidor después de entregado", JSON.stringify({
    status: deliveredView.data?.status,
    courier: deliveredView.data?.courier,
  }, null, 2));

  // ---- 5.8: CORS ----
  const cors = await fetch(`${BASE}/api/health`, {
    headers: { Origin: "https://evil.example" },
  });
  log("CORS desde origen no confiable", JSON.stringify({
    status: cors.status,
    allowOrigin: cors.headers.get("access-control-allow-origin"),
  }, null, 2));

  // ---- limpieza: cancelar pedidos de prueba ----
  const merchant = cookie("local@fogon.cl");
  for (const id of [race.order.orderId, leak.order.orderId]) {
    const current = await db.order.findUnique({ where: { id } });
    if (current && !current.status.startsWith("CANCELLED") && current.status !== "DELIVERED") {
      await api(`/api/orders/${id}`, {
        method: "PATCH",
        cookieHeader: merchant,
        body: { status: "CANCELLED_BY_MERCHANT", reason: "Prueba de seguridad" },
      });
    }
  }
} finally {
  for (const id of createdOrderIds) {
    const order = await db.order.findUnique({ where: { id } });
    if (!order) continue;
    await db.review.deleteMany({ where: { orderId: id } });
    await db.orderEvent.deleteMany({ where: { orderId: id } });
    await db.payment.deleteMany({ where: { orderId: id } });
    await db.deliveryOffer.deleteMany({ where: { orderId: id } });
    await db.orderItem.deleteMany({ where: { orderId: id } });
    await db.order.delete({ where: { id } });
  }

  for (const c of original) {
    await db.courier.update({
      where: { id: c.id },
      data: {
        status: c.status,
        verificationStatus: c.verificationStatus,
        currentLat: c.lat,
        currentLng: c.lng,
        lastSeenAt: c.lastSeenAt,
      },
    });
  }
  await db.$disconnect();
  console.log("\n\nRESUMEN\n", JSON.stringify(results, null, 2));
}
