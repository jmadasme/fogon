import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KEEP = "92460";

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "sofia." } },
        { email: { startsWith: "angel." } },
      ],
    },
    select: { id: true, email: true },
  });

  let deletedUsers = 0;
  let deletedStores = 0;
  let deletedOrders = 0;

  for (const user of users) {
    if (user.email.includes(KEEP)) continue;

    const merchant = await prisma.merchant.findUnique({
      where: { ownerId: user.id },
      include: { stores: true },
    });

    if (merchant) {
      for (const store of merchant.stores) {
        const orders = await prisma.order.findMany({
          where: { storeId: store.id },
          select: { id: true },
        });
        for (const order of orders) {
          await prisma.review.deleteMany({ where: { orderId: order.id } });
          await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
          await prisma.payment.deleteMany({ where: { orderId: order.id } });
          await prisma.deliveryOffer.deleteMany({ where: { orderId: order.id } });
          await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
          await prisma.order.delete({ where: { id: order.id } });
          deletedOrders++;
        }
        await prisma.store.delete({ where: { id: store.id } });
        deletedStores++;
      }
      await prisma.merchant.delete({ where: { id: merchant.id } });
    }

    const courier = await prisma.courier.findUnique({
      where: { userId: user.id },
    });
    if (courier) {
      await prisma.order.updateMany({
        where: { courierId: courier.id },
        data: { courierId: null },
      });
      await prisma.courier.delete({ where: { id: courier.id } });
    }

    await prisma.user.delete({ where: { id: user.id } });
    deletedUsers++;
    console.log(`Limpiado ${user.email}`);
  }

  console.log(
    `\nQA cleanup: ${deletedUsers} usuarios, ${deletedStores} locales, ${deletedOrders} pedidos eliminados.`,
  );
  console.log(`Se conserva la corrida ${KEEP}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
