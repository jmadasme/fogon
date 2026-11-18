-- Evita que un webhook viejo/de replayed sobrescriba una decisión más nueva.
ALTER TABLE "KycCase" ADD COLUMN "providerEventAt" TIMESTAMP(3);

-- Cada sesión del proveedor debe apuntar a un único caso.
CREATE UNIQUE INDEX "KycCase_providerRef_key" ON "KycCase"("providerRef");

-- Una reseña por pedido, autor y objetivo; evita carreras que inflan ratings.
CREATE UNIQUE INDEX "Review_orderId_authorId_targetType_key"
  ON "Review"("orderId", "authorId", "targetType");
