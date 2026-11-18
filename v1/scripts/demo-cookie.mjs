import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const email = process.argv[2] ?? "cliente@fogon.cl";

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`No existe ${email}`);
  process.exit(1);
}

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
const token = await new SignJWT({
  email: user.email,
  name: user.name,
  role: user.role,
  ver: user.tokenVersion,
  purpose: "session",
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer("fogon")
  .setAudience("fogon-web")
  .setSubject(user.id)
  .setIssuedAt()
  .setExpirationTime("7d")
  .sign(secret);

console.log(`fogon_session=${token}`);
await prisma.$disconnect();
