-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLng" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Job_locationLat_locationLng_idx" ON "Job"("locationLat", "locationLng");

-- CreateIndex
CREATE INDEX "User_locationLat_locationLng_idx" ON "User"("locationLat", "locationLng");
