/*
  Warnings:

  - You are about to drop the column `countryCode` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `countryCode` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Job_countryCode_admin1_idx";

-- DropIndex
DROP INDEX "Job_countryCode_city_idx";

-- DropIndex
DROP INDEX "Job_countryCode_idx";

-- DropIndex
DROP INDEX "User_countryCode_admin1_idx";

-- DropIndex
DROP INDEX "User_countryCode_city_idx";

-- DropIndex
DROP INDEX "User_countryCode_idx";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "countryCode",
ADD COLUMN     "country" VARCHAR(2);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "countryCode",
ADD COLUMN     "country" VARCHAR(2);

-- CreateIndex
CREATE INDEX "Job_country_idx" ON "Job"("country");

-- CreateIndex
CREATE INDEX "Job_country_admin1_idx" ON "Job"("country", "admin1");

-- CreateIndex
CREATE INDEX "Job_country_city_idx" ON "Job"("country", "city");

-- CreateIndex
CREATE INDEX "User_country_idx" ON "User"("country");

-- CreateIndex
CREATE INDEX "User_country_admin1_idx" ON "User"("country", "admin1");

-- CreateIndex
CREATE INDEX "User_country_city_idx" ON "User"("country", "city");
