import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const source = process.env.SQLITE_PATH ?? "prisma/dev.db";
const sqlite = new DatabaseSync(source, { readOnly: true });
const db = new PrismaClient();

const ORDER = [
  ["User", "user"],
  ["Zone", "zone"],
  ["Merchant", "merchant"],
  ["Address", "address"],
  ["Store", "store"],
  ["Category", "category"],
  ["MenuItem", "menuItem"],
  ["Modifier", "modifier"],
  ["ModifierOption", "modifierOption"],
  ["Courier", "courier"],
  ["Order", "order"],
  ["OrderItem", "orderItem"],
  ["OrderEvent", "orderEvent"],
  ["DeliveryOffer", "deliveryOffer"],
  ["Payment", "payment"],
  ["Review", "review"],
  ["AuditLog", "auditLog"],
];

const DATES = {
  User: ["createdAt", "updatedAt"],
  Address: ["createdAt"],
  Merchant: ["createdAt", "updatedAt"],
  Store: ["createdAt", "updatedAt"],
  MenuItem: ["createdAt"],
  Order: [
    "deliveryPinLockedUntil",
    "scheduledAt",
    "acceptedAt",
    "readyAt",
    "courierAssignedAt",
    "pickedUpAt",
    "outForDeliveryAt",
    "deliveredAt",
    "createdAt",
    "updatedAt",
  ],
  OrderEvent: ["createdAt"],
  Courier: ["lastSeenAt", "createdAt", "updatedAt"],
  DeliveryOffer: ["expiresAt", "createdAt"],
  Payment: ["createdAt", "updatedAt"],
  Review: ["createdAt"],
  AuditLog: ["createdAt"],
};

const BOOLEANS = {
  Address: ["isDefault"],
  MenuItem: ["available"],
  Modifier: ["required"],
  Zone: ["active"],
};

function convert(table, row) {
  const result = { ...row };
  for (const field of DATES[table] ?? []) {
    const value = result[field];
    result[field] =
      value === null || value === undefined ? null : new Date(Number(value));
  }
  for (const field of BOOLEANS[table] ?? []) {
    result[field] = Boolean(result[field]);
  }
  return result;
}

try {
  for (const [table, model] of ORDER) {
    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
    if (rows.length === 0) {
      console.log(`${table}: 0`);
      continue;
    }
    const data = rows.map((row) => convert(table, row));
    await db[model].createMany({ data });
    console.log(`${table}: ${data.length}`);
  }
  console.log("Migración SQLite → PostgreSQL completada.");
} finally {
  sqlite.close();
  await db.$disconnect();
}
