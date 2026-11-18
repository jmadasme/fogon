import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  CUISINES,
  CUISINE_NAMES,
  DELIVERY_BASE_FEE,
  SANTIAGO_COMUNAS,
} from "@/lib/constants";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export async function GET(request: Request) {
  const limit = rateLimit(`mobile-home:${getClientIp(request)}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q")?.trim() ?? "").slice(0, 80);
  const comuna = (url.searchParams.get("comuna")?.trim() ?? "").slice(0, 80);
  const cuisine = (url.searchParams.get("cuisine")?.trim() ?? "").slice(0, 80);

  const allStores = await db.store.findMany({
    where: {
      status: "ACTIVE",
      merchant: { status: "VERIFIED" },
      ...(comuna ? { comuna } : {}),
      ...(cuisine ? { cuisine } : {}),
    },
    orderBy: [{ rating: "desc" }, { ratingCount: "desc" }],
    take: 200,
  });

  const stores = (
    q
      ? allStores.filter((store) =>
          normalize(
            [store.name, store.cuisine, store.comuna, store.description].join(" "),
          ).includes(normalize(q)),
        )
      : allStores
  ).slice(0, 60);

  return NextResponse.json({
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: store.description,
      cuisine: store.cuisine,
      emoji: store.emoji,
      comuna: store.comuna,
      address: store.address,
      lat: store.lat,
      lng: store.lng,
      rating: store.rating,
      ratingCount: store.ratingCount,
      prepTimeMin: store.prepTimeMin,
      minOrder: store.minOrder,
      coverUrl: store.coverUrl,
      deliveryFeeFrom: DELIVERY_BASE_FEE,
    })),
    communes: SANTIAGO_COMUNAS,
    cuisines: CUISINE_NAMES.map((name) => ({
      name,
      emoji: CUISINES[name].emoji,
    })),
  });
}
