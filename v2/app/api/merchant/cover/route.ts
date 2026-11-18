import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { imageSize } from "image-size";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { BodyTooLargeError, readFormBody, UPLOAD_BODY_LIMIT } from "@/lib/request";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

function detectImage(buffer: Buffer): "jpg" | "png" | "webp" | "gif" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 4) === "GIF8") {
    return "gif";
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "MERCHANT") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (process.env.MFA_ENFORCED === "true" && !session.mfaEnabled) {
    return NextResponse.json(
      { error: "Completa la configuración de MFA para continuar." },
      { status: 403 },
    );
  }

  const merchant = await db.merchant.findUnique({ where: { ownerId: session.id } });
  if (!merchant) {
    return NextResponse.json({ error: "No tienes un local asociado." }, { status: 403 });
  }

  const limit = rateLimit(`cover:${merchant.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas subidas. Espera un rato." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let formData: FormData;
  try {
    formData = await readFormBody(request, UPLOAD_BODY_LIMIT);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return NextResponse.json(
        { error: "La imagen no puede superar 5 MB." },
        { status: 413 },
      );
    }
    return NextResponse.json({ error: "No pudimos leer la imagen." }, { status: 400 });
  }

  const storeId = String(formData.get("storeId") ?? "");
  const cover = formData.get("cover");
  if (!storeId || !(cover instanceof File)) {
    return NextResponse.json({ error: "Selecciona una imagen." }, { status: 400 });
  }
  if (cover.size === 0) {
    return NextResponse.json({ error: "La imagen está vacía." }, { status: 400 });
  }
  if (cover.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "La imagen no puede superar 5 MB." },
      { status: 413 },
    );
  }

  const store = await db.store.findFirst({
    where: { id: storeId, merchantId: merchant.id },
  });
  if (!store) {
    return NextResponse.json({ error: "Local no encontrado." }, { status: 404 });
  }

  const buffer = Buffer.from(await cover.arrayBuffer());
  const extension = detectImage(buffer);
  if (!extension) {
    return NextResponse.json(
      { error: "Formato no permitido. Usa JPG, PNG, WEBP o GIF." },
      { status: 415 },
    );
  }

  try {
    const dimensions = imageSize(buffer);
    const width = dimensions.width ?? 0;
    const height = dimensions.height ?? 0;
    if (
      width <= 0 ||
      height <= 0 ||
      width > 8000 ||
      height > 8000 ||
      width * height > 40_000_000
    ) {
      return NextResponse.json(
        { error: "La imagen es demasiado grande en dimensiones." },
        { status: 413 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer las dimensiones de la imagen." },
      { status: 415 },
    );
  }

  const fileName = `${store.id}-${Date.now()}.${extension}`;
  const directory = path.join(process.cwd(), "public", "uploads", "stores");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), buffer);

  const coverUrl = `/uploads/stores/${fileName}`;
  await db.store.update({
    where: { id: store.id },
    data: { coverUrl },
  });

  revalidatePath("/merchant/menu");
  revalidatePath("/");
  revalidatePath(`/store/${store.slug}`);

  return NextResponse.json({ ok: true, url: coverUrl });
}
