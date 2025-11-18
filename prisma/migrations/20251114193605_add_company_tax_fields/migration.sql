-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "cfdiUseDefault" VARCHAR(5),
ADD COLUMN     "taxAddressLine1" TEXT,
ADD COLUMN     "taxAddressLine2" TEXT,
ADD COLUMN     "taxDataCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxEmail" TEXT,
ADD COLUMN     "taxLegalName" TEXT,
ADD COLUMN     "taxRegime" VARCHAR(3),
ADD COLUMN     "taxRfc" VARCHAR(13),
ADD COLUMN     "taxZip" VARCHAR(5);
