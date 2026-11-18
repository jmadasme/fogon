-- Permite reanudar una sesión KYC reciente sin crear otra sesión facturable.
ALTER TABLE "KycCase" ADD COLUMN "providerUrl" TEXT;
