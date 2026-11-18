import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getRequestSession } from "@/lib/mobile-auth";
import { db } from "@/lib/db";
import { orderStatusSchema } from "@/lib/validation";
import { canTransition, type Actor } from "@/lib/order-status";
import { getOrderForViewer } from "@/lib/orders/view";
import { haversineKm } from "@/lib/utils";
import { exceedsBodyLimit, SMALL_JSON_BODY_LIMIT } from "@/lib/request";
import {
  courierSecurityEnforced,
  maxLocationAgeMs,
  outsideSantiago,
  pickupRadiusKm,
} from "@/lib/courier/security";

class TransitionConflict extends Error {}

async function loadOrder(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      store: { include: { merchant: true } },
      courier: { include: { user: true } },
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      payment: true,
      reviews: true,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;
  const result = await getOrderForViewer(id, session);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.order);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  if (exceedsBodyLimit(request, SMALL_JSON_BODY_LIMIT)) {
    return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  }
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  const order = await loadOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  }

  const actor: Actor = {
    id: session.id,
    role: session.role,
  };

  if (session.role === "MERCHANT") {
    const stores = await db.store.findMany({
      where: { merchant: { ownerId: session.id } },
      select: { id: true },
    });
    actor.merchantStoreIds = stores.map((store) => store.id);
  }
  if (session.role === "COURIER") {
    const courier = await db.courier.findUnique({
      where: { userId: session.id },
      select: {
        id: true,
        verificationStatus: true,
        status: true,
        currentLat: true,
        currentLng: true,
        lastSeenAt: true,
      },
    });
    if (!courier || courier.verificationStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: "Tu cuenta de repartidor aún no está verificada." },
        { status: 403 },
      );
    }
    actor.courierId = courier.id;

    if (parsed.data.status === "COURIER_ASSIGNED") {
      if (courier.status !== "AVAILABLE") {
        return NextResponse.json(
          { error: "Conéctate y termina tu entrega activa antes de aceptar otra." },
          { status: 409 },
        );
      }
      const activeCount = await db.order.count({
        where: {
          courierId: courier.id,
          status: { in: ["COURIER_ASSIGNED", "PICKED_UP"] },
        },
      });
      if (activeCount > 0) {
        return NextResponse.json(
          { error: "Ya tienes una entrega activa." },
          { status: 409 },
        );
      }
      const recentCancellations = await db.order.count({
        where: {
          courierId: courier.id,
          status: "CANCELLED_BY_COURIER",
          updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (recentCancellations >= 3) {
        return NextResponse.json(
          {
            error:
              "Tienes demasiadas cancelaciones recientes. Contacta a soporte.",
          },
          { status: 409 },
        );
      }
      if (courier.currentLat == null || courier.currentLng == null) {
        return NextResponse.json(
          { error: "Activa tu ubicación para aceptar pedidos." },
          { status: 409 },
        );
      }
      if (
        !courier.lastSeenAt ||
        Date.now() - courier.lastSeenAt.getTime() > maxLocationAgeMs()
      ) {
        return NextResponse.json(
          {
            error:
              "Tu ubicación está desactualizada. Vuelve a conectarte y activa el GPS.",
          },
          { status: 409 },
        );
      }
      if (
        courierSecurityEnforced() &&
        outsideSantiago(courier.currentLat, courier.currentLng)
      ) {
        return NextResponse.json(
          { error: "Estás fuera de la zona de operación de Santiago." },
          { status: 409 },
        );
      }
      const distanceToStore = haversineKm(
        { lat: courier.currentLat, lng: courier.currentLng },
        { lat: order.store.lat, lng: order.store.lng },
      );
      if (distanceToStore > 15) {
        return NextResponse.json(
          { error: "El local está fuera de tu zona de reparto." },
          { status: 409 },
        );
      }
    }
  }

  if (!canTransition(order, parsed.data.status, actor)) {
    return NextResponse.json(
      { error: "No puedes ejecutar esa acción en este estado." },
      { status: 409 },
    );
  }

  if (
    parsed.data.status === "PICKED_UP" &&
    session.role === "COURIER" &&
    courierSecurityEnforced()
  ) {
    const location = await db.courier.findUnique({
      where: { userId: session.id },
      select: { currentLat: true, currentLng: true, lastSeenAt: true },
    });
    if (
      location?.currentLat == null ||
      location.currentLng == null ||
      !location.lastSeenAt ||
      Date.now() - location.lastSeenAt.getTime() > maxLocationAgeMs()
    ) {
      return NextResponse.json(
        {
          error:
            "Activa tu ubicación y espera unos segundos antes de confirmar el retiro.",
        },
        { status: 409 },
      );
    }
    const distanceToStore = haversineKm(
      { lat: location.currentLat, lng: location.currentLng },
      { lat: order.store.lat, lng: order.store.lng },
    );
    if (distanceToStore > pickupRadiusKm()) {
      return NextResponse.json(
        {
          error:
            "Confirma el retiro desde el local. Tu ubicación está demasiado lejos.",
        },
        { status: 409 },
      );
    }
  }

  if (parsed.data.status === "DELIVERED" && session.role === "COURIER") {
    if (
      order.deliveryPinLockedUntil &&
      order.deliveryPinLockedUntil.getTime() > Date.now()
    ) {
      const retryAfter = Math.ceil(
        (order.deliveryPinLockedUntil.getTime() - Date.now()) / 1000,
      );
      return NextResponse.json(
        {
          error:
            "Demasiados intentos de PIN. Espera unos minutos o contacta a soporte.",
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    if (parsed.data.pin !== order.deliveryPin) {
      const attempted = await db.order.update({
        where: { id: order.id },
        data: { deliveryPinAttempts: { increment: 1 } },
        select: { deliveryPinAttempts: true },
      });

      if (attempted.deliveryPinAttempts >= 5) {
        await db.order.update({
          where: { id: order.id },
          data: {
            deliveryPinLockedUntil: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
        return NextResponse.json(
          {
            error:
              "Demasiados intentos fallidos. El PIN quedó bloqueado por 15 minutos.",
          },
          { status: 429, headers: { "Retry-After": "900" } },
        );
      }

      const remaining = Math.max(0, 5 - attempted.deliveryPinAttempts);
      return NextResponse.json(
        {
          error: `PIN incorrecto. Te quedan ${remaining} intento${
            remaining === 1 ? "" : "s"
          }.`,
        },
        { status: 400 },
      );
    }
  }

  const nextStatus = parsed.data.status;
  const now = new Date();
  const data: Prisma.OrderUncheckedUpdateManyInput = { status: nextStatus };

  switch (nextStatus) {
    case "ACCEPTED":
      data.acceptedAt = now;
      break;
    case "READY":
      data.readyAt = now;
      break;
    case "PENDING_COURIER":
      data.fulfillment = "PLATFORM";
      break;
    case "COURIER_ASSIGNED":
      data.fulfillment = "PLATFORM";
      data.courierId = actor.courierId;
      data.courierAssignedAt = now;
      break;
    case "PICKED_UP":
      data.pickedUpAt = now;
      break;
    case "OUT_FOR_DELIVERY":
      data.fulfillment = "OWN";
      data.outForDeliveryAt = now;
      break;
    case "DELIVERED":
      data.deliveredAt = now;
      data.deliveryPinAttempts = 0;
      data.deliveryPinLockedUntil = null;
      if (order.paymentProvider === "CASH" && order.paymentStatus !== "PAID") {
        data.paymentStatus = "PAID";
      }
      break;
    default:
      if (nextStatus.startsWith("CANCELLED")) {
        data.cancellationReason =
          parsed.data.reason ?? "Cancelado desde la aplicación";
        if (order.paymentStatus === "PAID") {
          data.paymentStatus =
            order.paymentProvider === "MOCK" ? "REFUNDED" : "REFUND_PENDING";
        } else {
          data.paymentStatus = "CANCELLED";
        }
      }
  }

  const eventType =
    nextStatus === "ACCEPTED"
      ? "MERCHANT_ACCEPTED"
      : nextStatus === "CANCELLED_BY_MERCHANT"
        ? "MERCHANT_REJECTED"
        : nextStatus.startsWith("CANCELLED")
          ? "CANCELLED"
          : nextStatus;

  const updated = await db
    .$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          ...(nextStatus === "COURIER_ASSIGNED" ? { courierId: null } : {}),
        },
        data,
      });
      if (changed.count !== 1) throw new TransitionConflict();

      const result = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: eventType,
          actorId: session.id,
          payload: JSON.stringify({
            from: order.status,
            to: nextStatus,
            reason: parsed.data.reason,
          }),
        },
      });

      if (nextStatus === "DELIVERED" || nextStatus.startsWith("CANCELLED")) {
        if (order.courierId) {
          const remaining = await tx.order.count({
            where: {
              courierId: order.courierId,
              status: { in: ["COURIER_ASSIGNED", "PICKED_UP"] },
            },
          });
          await tx.courier.update({
            where: { id: order.courierId },
            data: { status: remaining > 0 ? "BUSY" : "AVAILABLE" },
          });
        }
      }

      if (nextStatus === "COURIER_ASSIGNED" && actor.courierId) {
        await tx.courier.update({
          where: { id: actor.courierId },
          data: { status: "BUSY" },
        });
      }

      if (
        nextStatus.startsWith("CANCELLED") &&
        order.paymentProvider === "CASH" &&
        order.paymentStatus !== "PAID"
      ) {
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: { status: "CANCELLED" },
        });
      }

      if (
        nextStatus === "DELIVERED" &&
        order.paymentProvider === "CASH" &&
        order.paymentStatus !== "PAID"
      ) {
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: { status: "PAID" },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: "PAYMENT_CONFIRMED",
            actorId: session.id,
            payload: JSON.stringify({ provider: "CASH", collected: true }),
          },
        });
      }

      return result;
    })
    .catch((error) => {
      if (error instanceof TransitionConflict) return null;
      throw error;
    });

  if (!updated) {
    return NextResponse.json(
      { error: "El pedido cambió de estado. Recarga e intenta de nuevo." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    paymentStatus: updated.paymentStatus,
  });
}
