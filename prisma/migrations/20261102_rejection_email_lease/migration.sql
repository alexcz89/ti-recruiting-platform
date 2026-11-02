
-- Reserva temporal para evitar envíos concurrentes
-- de correos de rechazo.

ALTER TABLE "Application"
  ADD COLUMN "rejectionEmailLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "rejectionEmailLeaseToken" TEXT;
    