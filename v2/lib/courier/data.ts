import "server-only";

import { db } from "@/lib/db";
import { COMUNA_BY_NAME } from "@/lib/constants";
import { haversineKm } from "@/lib/utils";
import type {
  AvailableCourierOrder,
  CourierDashboard,
  CourierOrder,
} from "@/lib/courier/types";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek() {
  const today = startOfToday();
  const day = today.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - diff);
  return monday;
}

function orderToCourierOrder(order: {
  id: string;
  code: string;
  status: string;
  total: number;
  courierPayout: number;
  distanceKm: number;
  addressLine: string;
  comuna: string;
  lat: number;
  lng: number;
  instructions: string | null;
  createdAt: Date;
  store: {
    name: string;
    emoji: string;
    comuna: string;
    address: string;
    lat: number;
    lng: number;
  };
  customer: { name: string; phone: string | null };
  items: { id: string; nameSnapshot: string; quantity: number; unitPrice: number; notes: string | null }[];
}, distanceToStore: number): CourierOrder {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    total: order.total,
    courierPayout: order.courierPayout,
    distanceKm: order.distanceKm,
    distanceToStore,
    addressLine: order.addressLine,
    comuna: order.comuna,
    lat: order.lat,
    lng: order.lng,
    instructions: order.instructions,
    createdAt: order.createdAt.toISOString(),
    store: {
      name: order.store.name,
      emoji: order.store.emoji,
      comuna: order.store.comuna,
      address: order.store.address,
      lat: order.store.lat,
      lng: order.store.lng,
    },
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      notes: item.notes,
    })),
  };
}

function toAvailableOrder(
  order: {
    id: string;
    code: string;
    status: string;
    courierPayout: number;
    distanceKm: number;
    comuna: string;
    createdAt: Date;
    items: { quantity: number }[];
    store: {
      name: string;
      emoji: string;
      comuna: string;
      address: string;
      lat: number;
      lng: number;
    };
  },
  distanceToStore: number,
): AvailableCourierOrder {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    courierPayout: order.courierPayout,
    distanceKm: order.distanceKm,
    distanceToStore,
    comuna: order.comuna,
    createdAt: order.createdAt.toISOString(),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    store: {
      name: order.store.name,
      emoji: order.store.emoji,
      comuna: order.store.comuna,
      address: order.store.address,
      lat: order.store.lat,
      lng: order.store.lng,
    },
  };
}

export async function getCourierDashboard(
  courierId: string,
): Promise<CourierDashboard | null> {
  const courier = await db.courier.findUnique({
    where: { id: courierId },
    include: { user: true },
  });
  if (!courier) return null;

  const origin =
    courier.currentLat != null && courier.currentLng != null
      ? { lat: courier.currentLat, lng: courier.currentLng }
      : COMUNA_BY_NAME.get(courier.zone ?? "") ?? {
          lat: -33.4489,
          lng: -70.6693,
        };

  const availableRaw = await db.order.findMany({
    where: {
      status: "PENDING_COURIER",
      fulfillment: "PLATFORM",
      deliveryMode: "DELIVERY",
    },
    include: {
      store: {
        select: {
          name: true,
          emoji: true,
          comuna: true,
          address: true,
          lat: true,
          lng: true,
        },
      },
      items: { select: { quantity: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  const available = availableRaw
    .map((order) => {
      const distanceToStore = haversineKm(origin, {
        lat: order.store.lat,
        lng: order.store.lng,
      });
      return { order, distanceToStore };
    })
    .filter(({ distanceToStore }) => distanceToStore <= 15)
    .sort((a, b) => a.distanceToStore - b.distanceToStore)
    .slice(0, 12)
    .map(({ order, distanceToStore }) =>
      toAvailableOrder(order, Number(distanceToStore.toFixed(1))),
    );

  const activeRaw = await db.order.findFirst({
    where: {
      courierId,
      status: { in: ["COURIER_ASSIGNED", "PICKED_UP"] },
    },
    include: {
      store: {
        select: {
          name: true,
          emoji: true,
          comuna: true,
          address: true,
          lat: true,
          lng: true,
        },
      },
      customer: { select: { name: true, phone: true } },
      items: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const [todayAgg, weekAgg, todayCount, weekCount] = await Promise.all([
    db.order.aggregate({
      where: {
        courierId,
        status: "DELIVERED",
        deliveredAt: { gte: startOfToday() },
      },
      _sum: { courierPayout: true },
    }),
    db.order.aggregate({
      where: {
        courierId,
        status: "DELIVERED",
        deliveredAt: { gte: startOfWeek() },
      },
      _sum: { courierPayout: true },
    }),
    db.order.count({
      where: {
        courierId,
        status: "DELIVERED",
        deliveredAt: { gte: startOfToday() },
      },
    }),
    db.order.count({
      where: {
        courierId,
        status: "DELIVERED",
        deliveredAt: { gte: startOfWeek() },
      },
    }),
  ]);

  return {
    courier: {
      id: courier.id,
      status: courier.status,
      verificationStatus: courier.verificationStatus,
      vehicle: courier.vehicle,
      zone: courier.zone,
      rating: courier.rating,
      ratingCount: courier.ratingCount,
      currentLat: courier.currentLat,
      currentLng: courier.currentLng,
      name: courier.user.name,
      phone: courier.phone ?? courier.user.phone,
    },
    available,
    active: activeRaw
      ? orderToCourierOrder(
          activeRaw,
          Number(
            haversineKm(origin, {
              lat: activeRaw.store.lat,
              lng: activeRaw.store.lng,
            }).toFixed(1),
          ),
        )
      : null,
    earnings: {
      today: todayAgg._sum.courierPayout ?? 0,
      week: weekAgg._sum.courierPayout ?? 0,
      deliveriesToday: todayCount,
      deliveriesWeek: weekCount,
    },
  };
}
