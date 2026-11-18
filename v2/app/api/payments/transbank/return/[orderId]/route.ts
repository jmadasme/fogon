import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  confirmTransbankPayment,
  refundTransbankTransaction,
} from "@/lib/payments";
import { markOrderPaid, markPaymentFailed } from "@/lib/payments/sync";

function redirectTo(request: Request, path: string) {
  const base =
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_APP_URL!
      : request.url;
  return NextResponse.redirect(new URL(path, base));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token_ws");
  const cancelledToken = url.searchParams.get("TBK_TOKEN");

  if (!token) {
    return redirectTo(
      request,
      `/order/${orderId}?payment=${cancelledToken ? "cancelled" : "failed"}`,
    );
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) {
    return redirectTo(request, "/orders?payment=error");
  }

  if (order.paymentStatus === "PAID") {
    return redirectTo(request, `/order/${orderId}?payment=success`);
  }

  if (
    order.paymentProvider !== "TRANSBANK" ||
    order.paymentRef !== token ||
    order.payment?.provider !== "TRANSBANK"
  ) {
    console.warn("Transbank return: token no coincide con el pedido", {
      orderId,
    });
    return redirectTo(request, `/order/${orderId}?payment=error`);
  }

  try {
    const result = await confirmTransbankPayment(orderId, token);

    if (
      result.status !== "approved" ||
      result.buyOrder !== order.code ||
      Number(result.amount) !== Number(order.total)
    ) {
      if (result.status === "approved") {
        try {
          await refundTransbankTransaction(token, Number(result.amount));
        } catch (refundError) {
          console.error("Transbank return: no se pudo reversar el monto", refundError);
        }
      }
      await markPaymentFailed({
        orderId,
        provider: "TRANSBANK",
        providerRef: result.providerRef,
        raw: JSON.stringify({
          reason: "validacion_monto_orden",
          buyOrder: result.buyOrder,
          amount: result.amount,
          expectedBuyOrder: order.code,
          expectedAmount: order.total,
        }),
      });
      console.warn("Transbank return: validación de orden/monto falló", {
        orderId,
      });
      return redirectTo(request, `/order/${orderId}?payment=failed`);
    }

    await markOrderPaid({
      orderId,
      provider: "TRANSBANK",
      providerRef: result.providerRef,
      raw: result.raw,
    });
    return redirectTo(request, `/order/${orderId}?payment=success`);
  } catch (error) {
    console.error("Transbank return error", error);
    return redirectTo(request, `/order/${orderId}?payment=error`);
  }
}
