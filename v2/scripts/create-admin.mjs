// Bootstrap del primer ADMIN en producción (donde no corre el seed demo).
//
// Uso (en el VPS, desde deploy/):
//   docker compose run --rm --entrypoint sh migrate \
//     -c "./node_modules/.bin/prisma generate && node scripts/create-admin.mjs admin@tudominio.cl"
//
// Si no se pasa contraseña, se genera una aleatoria y se imprime UNA vez.
// Al primer login, MFA_ENFORCED=true exige configurar TOTP.
// En local (dev): node scripts/create-admin.mjs <email> [contraseña]

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.POSTGRES_PASSWORD;
  if (!password || password === "change-me" || password.length < 16) {
    console.error(
      "Falta DATABASE_URL o POSTGRES_PASSWORD (mínimo 16 caracteres).",
    );
    process.exit(1);
  }
  const user = process.env.POSTGRES_USER ?? "fogon";
  const db = process.env.POSTGRES_DB ?? "fogon";
  return `postgresql://${user}:${password}@db:5432/${db}?schema=public`;
}

const email = process.argv[2]?.toLowerCase().trim();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Uso: node scripts/create-admin.mjs <email> [contraseña]");
  process.exit(1);
}

let password = process.argv[3];
let generated = false;
if (!password) {
  password = crypto.randomBytes(15).toString("base64url");
  generated = true;
}
if (password.length < 12) {
  console.error("La contraseña debe tener al menos 12 caracteres.");
  process.exit(1);
}

process.env.DATABASE_URL = resolveDatabaseUrl();
const db = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      // Revoca sesiones previas si el usuario ya existía.
      tokenVersion: { increment: 1 },
    },
    create: {
      email,
      name: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
    },
  });
  console.log(`ADMIN listo: ${user.email} (id ${user.id})`);
  if (generated) {
    console.log(
      `Contraseña generada (guárdala AHORA, no se vuelve a mostrar): ${password}`,
    );
  }
  console.log(
    "Al iniciar sesión se exigirá configurar MFA (MFA_ENFORCED=true).",
  );
} finally {
  await db.$disconnect();
}
