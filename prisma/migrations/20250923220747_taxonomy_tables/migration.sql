-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('SKILL', 'CERTIFICATION');

-- CreateTable
CREATE TABLE "TaxonomyTerm" (
    "id" TEXT NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequiredSkill" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "must" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER,

    CONSTRAINT "JobRequiredSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "level" INTEGER,
    "years" INTEGER,

    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "issuer" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "credentialId" TEXT,
    "url" TEXT,

    CONSTRAINT "CandidateCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxonomyTerm_kind_idx" ON "TaxonomyTerm"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyTerm_kind_slug_key" ON "TaxonomyTerm"("kind", "slug");

-- CreateIndex
CREATE INDEX "JobRequiredSkill_termId_idx" ON "JobRequiredSkill"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRequiredSkill_jobId_termId_key" ON "JobRequiredSkill"("jobId", "termId");

-- CreateIndex
CREATE INDEX "CandidateSkill_termId_idx" ON "CandidateSkill"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSkill_userId_termId_key" ON "CandidateSkill"("userId", "termId");

-- CreateIndex
CREATE INDEX "CandidateCredential_termId_idx" ON "CandidateCredential"("termId");

-- CreateIndex
CREATE INDEX "CandidateCredential_userId_termId_idx" ON "CandidateCredential"("userId", "termId");

-- AddForeignKey
ALTER TABLE "JobRequiredSkill" ADD CONSTRAINT "JobRequiredSkill_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRequiredSkill" ADD CONSTRAINT "JobRequiredSkill_termId_fkey" FOREIGN KEY ("termId") REFERENCES "TaxonomyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_termId_fkey" FOREIGN KEY ("termId") REFERENCES "TaxonomyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateCredential" ADD CONSTRAINT "CandidateCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateCredential" ADD CONSTRAINT "CandidateCredential_termId_fkey" FOREIGN KEY ("termId") REFERENCES "TaxonomyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
