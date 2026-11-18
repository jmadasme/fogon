import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getOrderForViewer } from "@/lib/orders/view";
import { OrderTrackingClient } from "@/components/order/order-tracking-client";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser(`/order/${id}`);
  const result = await getOrderForViewer(id, session);

  if (!result.ok) {
    notFound();
  }

  return <OrderTrackingClient initialOrder={result.order} />;
}
