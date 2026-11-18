import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KEEP = new Set([
  "FOG-4LHZBK",
  "FOG-2HPUSQ",
  "FOG-X4982B",
  "FOG-S5RELW",
]);
const CUTOFF = new Date("2026-11-07T21:30:00Z");
const TEST_USERS = [
  "sofia.48684@fogon.cl",
  "angel.48684@fogon.cl",
  "sofia.72949@fogon.cl",
  "angel.72949@fogon.cl",
  "sofia.92460@fogon.cl",
  "angel.92460@fogon.cl",
];

async function main() {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: CUTOFF }, code: { notIn: [...KEEP] } },
    select: { id: true, code: true },
  });

  for (const order of orders) {
    await prisma.review.deleteMany({ where: { orderId: order.id } });
    await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.deliveryOffer.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    console.log("Pedido eliminado", order.code);
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: TEST_USERS } },
        { email: { endsWith: "@test.cl" } },
      ],
    },
    select: { id: true, email: true },
  });
  for (const user of users) {
    await prisma.user.delete({ where: { id: user.id } });
    console.log("Usuario eliminado", user.email);
  }

  const counts = {
    orders: await prisma.order.count(),
    merchants: await prisma.merchant.count(),
    stores: await prisma.store.count(),
    couriers: await prisma.courier.count(),
    users: await prisma.user.count(),
  };
  console.log("Conteos finales", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
