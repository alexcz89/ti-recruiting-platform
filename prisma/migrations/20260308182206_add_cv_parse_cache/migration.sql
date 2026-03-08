/*
  Warnings:

  - Added the required column `parserVersion` to the `CvParseCache` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CvParseCache_cvHash_idx";

-- AlterTable
ALTER TABLE "CvParseCache" ADD COLUMN     "parserVersion" TEXT NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;
