import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

const orderDays = Number(process.env.PII_RETENTION_DAYS ?? 180);
const userDays = Number(process.env.USER_RETENTION_DAYS ?? 730);
const orderCutoff = new Date(Date.now() - orderDays * 24 * 60 * 60 * 1000);
const userCutoff = new Date(Date.now() - userDays * 24 * 60 * 60 * 1000);

async function main() {
  const orders = await db.order.findMany({
    where: {
      createdAt: { lt: orderCutoff },
      addressLine: { not: "[anonimizada]" },
    },
    select: { id: true },
  });

  const recentCustomers = await db.order.findMany({
    where: { createdAt: { gte: orderCutoff } },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  const activeCustomerIds = recentCustomers.map((row) => row.customerId);

  const addresses = await db.address.findMany({
    where: {
      createdAt: { lt: orderCutoff },
      userId: { notIn: activeCustomerIds },
      line1: { not: "[anonimizada]" },
    },
    select: { id: true },
  });

  const users = await db.user.findMany({
    where: {
      role: "CUSTOMER",
      createdAt: { lt: userCutoff },
      email: { not: { startsWith: "deleted-" } },
      id: { notIn: activeCustomerIds },
      customerOrders: { none: { createdAt: { gte: userCutoff } } },
    },
    select: { id: true },
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        orderDays,
        userDays,
        ordersToAnonymize: orders.length,
        addressesToAnonymize: addresses.length,
        usersToAnonymize: users.length,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Ejecuta con --apply para aplicar los cambios.");
    return;
  }

  if (orders.length > 0) {
    await db.order.updateMany({
      where: { id: { in: orders.map((order) => order.id) } },
      data: {
        addressLine: "[anonimizada]",
        instructions: null,
        lat: 0,
        lng: 0,
      },
    });
  }

  if (addresses.length > 0) {
    await db.address.updateMany({
      where: { id: { in: addresses.map((address) => address.id) } },
      data: {
        line1: "[anonimizada]",
        instructions: null,
        lat: 0,
        lng: 0,
      },
    });
  }

  for (const user of users) {
    const randomPassword = crypto.randomBytes(32).toString("base64url");
    await db.user.update({
      where: { id: user.id },
      data: {
        name: "Usuario eliminado",
        email: `deleted-${user.id}@anon.invalid`,
        phone: null,
        passwordHash: await bcrypt.hash(randomPassword, 10),
        status: "SUSPENDED",
        tokenVersion: { increment: 1 },
      },
    });
  }

  if (orders.length + addresses.length + users.length > 0) {
    await db.auditLog.create({
      data: {
        action: "pii.anonymize",
        entity: "System",
        entityId: "retention",
        after: JSON.stringify({
          orders: orders.length,
          addresses: addresses.length,
          users: users.length,
          orderDays,
          userDays,
        }),
      },
    });
  }

  console.log("Anonymización aplicada.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
