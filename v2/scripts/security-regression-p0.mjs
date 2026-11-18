import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.REGRESSION_BASE ?? "http://localhost:3002";
const db = new PrismaClient();
const stamp = Date.now();
const results = [];

async function login(email, password = "fogon123") {
  const response = await fetch(`${BASE}/api/mobile/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `login ${email} -> ${response.status}`);
  return (await response.json()).token;
}

async function main() {
  const customer = await db.user.findUnique({
    where: { email: "cliente@fogon.cl" },
    select: { id: true, name: true },
  });
  assert.ok(customer, "Falta cliente@fogon.cl");

  const store = await db.store.findFirst({
    where: { status: "ACTIVE" },
    include: {
      categories: {
        include: {
          items: {
            where: { available: true },
            include: { modifiers: { include: { options: true } } },
          },
        },
      },
    },
  });
  assert.ok(store, "Falta un local activo");
  const item = store.categories.flatMap((category) => category.items)[0];
  assert.ok(item, "Falta un ítem de menú");

  const customerToken = await login("cliente@fogon.cl");
  const orderBody = {
    storeId: store.id,
    clientRequestId: `regression-cash-${stamp}`,
    items: [
      {
        itemId: item.id,
        quantity: 1,
        modifierOptionIds: item.modifiers[0]?.options[0]
          ? [item.modifiers[0].options[0].id]
          : [],
      },
    ],
    deliveryMode: "PICKUP",
    tip: 0,
    paymentProvider: "CASH",
    customerName: customer.name,
  };

  const cash = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify(orderBody),
  });
  results.push({ test: "cash_rejected", status: cash.status });
  assert.equal(cash.status, 400, "CASH debería ser rechazado");

  const withoutId = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ ...orderBody, clientRequestId: undefined }),
  });
  results.push({ test: "client_request_id_required", status: withoutId.status });
  assert.equal(withoutId.status, 400, "clientRequestId debería ser obligatorio");

  const courierEmail = `p0-regression-${stamp}@fogon.cl`;
  let courierUser;
  let orderA;
  let orderB;

  try {
    courierUser = await db.user.create({
      data: {
        name: "P0 Regression Courier",
        email: courierEmail,
        passwordHash: await bcrypt.hash("fogon123", 10),
        role: "COURIER",
        emailVerifiedAt: new Date(),
      },
    });
    const courier = await db.courier.create({
      data: {
        userId: courierUser.id,
        vehicle: "MOTORCYCLE",
        zone: "Santiago",
        status: "AVAILABLE",
        verificationStatus: "VERIFIED",
        currentLat: store.lat,
        currentLng: store.lng,
        lastSeenAt: new Date(),
      },
    });

    const baseOrder = {
      customerId: customer.id,
      storeId: store.id,
      status: "PENDING_COURIER",
      deliveryMode: "DELIVERY",
      fulfillment: "PLATFORM",
      subtotal: 1000,
      total: 1000,
      paymentStatus: "PAID",
      paymentProvider: "FLOW",
      addressLine: "Dirección de prueba 123",
      comuna: store.comuna,
      lat: store.lat,
      lng: store.lng,
      pickupPin: "1234",
      deliveryPin: "9999",
    };
    orderA = await db.order.create({
      data: {
        ...baseOrder,
        code: `REG-A-${stamp}`,
        clientRequestId: `regression-courier-a-${stamp}`,
      },
    });
    orderB = await db.order.create({
      data: {
        ...baseOrder,
        code: `REG-B-${stamp}`,
        clientRequestId: `regression-courier-b-${stamp}`,
      },
    });

    const courierToken = await login(courierEmail);
    const assign = (id) =>
      fetch(`${BASE}/api/orders/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${courierToken}`,
        },
        body: JSON.stringify({ status: "COURIER_ASSIGNED" }),
      });

    const [first, second] = await Promise.all([
      assign(orderA.id),
      assign(orderB.id),
    ]);
    const assignedCount = await db.order.count({
      where: {
        courierId: courier.id,
        status: { in: ["COURIER_ASSIGNED", "PICKED_UP"] },
      },
    });
    results.push({
      test: "one_active_delivery",
      statuses: [first.status, second.status],
      assignedCount,
    });
    assert.equal(assignedCount, 1, "El repartidor no puede tener dos entregas");

    const assigned = await db.order.findFirst({
      where: { courierId: courier.id, status: "COURIER_ASSIGNED" },
      select: { id: true },
    });
    assert.ok(assigned, "No se asignó ningún pedido");
    await db.order.update({
      where: { id: assigned.id },
      data: {
        status: "PICKED_UP",
        pickedUpAt: new Date(),
        deliveryPinAttempts: 0,
        deliveryPinLockedUntil: null,
      },
    });

    const deliver = (pin) =>
      fetch(`${BASE}/api/orders/${assigned.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${courierToken}`,
        },
        body: JSON.stringify({ status: "DELIVERED", pin }),
      });

    const wrongStatuses = [];
    for (let i = 0; i < 5; i += 1) {
      wrongStatuses.push((await deliver("0000")).status);
    }
    const correct = await deliver("9999");
    const finalOrder = await db.order.findUnique({
      where: { id: assigned.id },
      select: {
        status: true,
        deliveryPinAttempts: true,
        deliveryPinLockedUntil: true,
      },
    });
    results.push({
      test: "pin_lock",
      wrongStatuses,
      correctStatus: correct.status,
      status: finalOrder?.status,
      attempts: finalOrder?.deliveryPinAttempts,
      locked: Boolean(finalOrder?.deliveryPinLockedUntil),
    });
    assert.equal(finalOrder?.status, "PICKED_UP", "El PIN no debe aceptarse");
    assert.equal(correct.status, 429, "El PIN correcto debe estar bloqueado");
  } finally {
    if (orderA) await db.order.delete({ where: { id: orderA.id } }).catch(() => {});
    if (orderB) await db.order.delete({ where: { id: orderB.id } }).catch(() => {});
    if (courierUser) {
      await db.user.delete({ where: { id: courierUser.id } }).catch(() => {});
    }
  }

  console.log(JSON.stringify({ ok: true, base: BASE, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
