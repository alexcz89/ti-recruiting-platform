-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('NATIVE', 'PROFESSIONAL', 'CONVERSATIONAL', 'BASIC');

-- AlterEnum
ALTER TYPE "TaxonomyKind" ADD VALUE 'LANGUAGE';

-- CreateTable
CREATE TABLE "CandidateLanguage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "level" "LanguageProficiency" NOT NULL,

    CONSTRAINT "CandidateLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateLanguage_termId_idx" ON "CandidateLanguage"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateLanguage_userId_termId_key" ON "CandidateLanguage"("userId", "termId");

-- AddForeignKey
ALTER TABLE "CandidateLanguage" ADD CONSTRAINT "CandidateLanguage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateLanguage" ADD CONSTRAINT "CandidateLanguage_termId_fkey" FOREIGN KEY ("termId") REFERENCES "TaxonomyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
