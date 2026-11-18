import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KEEP = new Set([
  "FOG-4LHZBK",
  "FOG-2HPUSQ",
  "FOG-X4982B",
  "FOG-S5RELW",
]);

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: new Date("2026-11-08T03:00:00Z") },
      code: { notIn: [...KEEP] },
    },
    select: { id: true, code: true },
  });

  for (const order of orders) {
    await prisma.review.deleteMany({ where: { orderId: order.id } });
    await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.deliveryOffer.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    console.log("Eliminado", order.code);
  }

  const other = await prisma.user.findUnique({
    where: { email: "qa.other@fogon.cl" },
  });
  if (other) {
    await prisma.user.delete({ where: { id: other.id } });
    console.log("Eliminado qa.other@fogon.cl");
  }

  console.log(`Pedidos eliminados: ${orders.length}. Conservados: ${[...KEEP].join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
