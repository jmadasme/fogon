-- P0 hardening: lock de creación de pago y una entrega activa por repartidor.
ALTER TABLE "Order" ADD COLUMN "paymentLockAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_active_courier_assignment"
  ON "Order" ("courierId")
  WHERE "courierId" IS NOT NULL
    AND "status" IN ('COURIER_ASSIGNED', 'PICKED_UP');
