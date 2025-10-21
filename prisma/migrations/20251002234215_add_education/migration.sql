-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('NONE', 'PRIMARY', 'SECONDARY', 'HIGH_SCHOOL', 'TECHNICAL', 'BACHELOR', 'MASTER', 'DOCTORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EducationStatus" AS ENUM ('ONGOING', 'COMPLETED', 'INCOMPLETE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "highestEducationLevel" "EducationLevel" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "Education" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "EducationLevel",
    "status" "EducationStatus" NOT NULL,
    "institution" TEXT NOT NULL,
    "program" TEXT,
    "country" VARCHAR(2),
    "city" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "grade" TEXT,
    "description" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Education_userId_status_idx" ON "Education"("userId", "status");

-- CreateIndex
CREATE INDEX "Education_userId_sortIndex_idx" ON "Education"("userId", "sortIndex");

-- CreateIndex
CREATE INDEX "Education_userId_endDate_idx" ON "Education"("userId", "endDate");

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
