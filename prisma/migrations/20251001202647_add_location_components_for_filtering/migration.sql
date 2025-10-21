-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "admin1" TEXT,
ADD COLUMN     "admin1Norm" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cityNorm" TEXT,
ADD COLUMN     "countryCode" VARCHAR(2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "admin1" TEXT,
ADD COLUMN     "admin1Norm" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cityNorm" TEXT,
ADD COLUMN     "countryCode" VARCHAR(2),
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "placeSource" TEXT;

-- CreateIndex
CREATE INDEX "Job_countryCode_idx" ON "Job"("countryCode");

-- CreateIndex
CREATE INDEX "Job_countryCode_admin1_idx" ON "Job"("countryCode", "admin1");

-- CreateIndex
CREATE INDEX "Job_countryCode_city_idx" ON "Job"("countryCode", "city");

-- CreateIndex
CREATE INDEX "Job_cityNorm_idx" ON "Job"("cityNorm");

-- CreateIndex
CREATE INDEX "Job_admin1Norm_idx" ON "Job"("admin1Norm");

-- CreateIndex
CREATE INDEX "User_countryCode_idx" ON "User"("countryCode");

-- CreateIndex
CREATE INDEX "User_countryCode_admin1_idx" ON "User"("countryCode", "admin1");

-- CreateIndex
CREATE INDEX "User_countryCode_city_idx" ON "User"("countryCode", "city");

-- CreateIndex
CREATE INDEX "User_cityNorm_idx" ON "User"("cityNorm");

-- CreateIndex
CREATE INDEX "User_admin1Norm_idx" ON "User"("admin1Norm");
