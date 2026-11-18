import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DELIVERY_BASE_FEE } from "@/lib/constants";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = await db.store.findUnique({
    where: { slug },
    include: {
      merchant: true,
      categories: {
        orderBy: { position: "asc" },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: { modifiers: { include: { options: true } } },
          },
        },
      },
    },
  });

  if (
    !store ||
    store.status !== "ACTIVE" ||
    store.merchant.status !== "VERIFIED"
  ) {
    return NextResponse.json({ error: "Local no encontrado." }, { status: 404 });
  }

  return NextResponse.json({
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
    deliveryMode: store.merchant.deliveryMode,
    categories: store.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        items: category.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          emoji: item.emoji,
          imageUrl: item.imageUrl,
          available: item.available,
          modifiers: item.modifiers.map((modifier) => ({
            id: modifier.id,
            name: modifier.name,
            type: modifier.type,
            required: modifier.required,
            min: modifier.min,
            max: modifier.max,
            options: modifier.options.map((option) => ({
              id: option.id,
              name: option.name,
              priceDelta: option.priceDelta,
            })),
          })),
        })),
      }))
      .filter((category) => category.items.length > 0),
  });
}
