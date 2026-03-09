-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "minYearsExperience" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "seniority" "Seniority",
ADD COLUMN     "yearsExperience" INTEGER;
