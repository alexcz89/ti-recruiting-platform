-- CreateTable
CREATE TABLE "CvParseCache" (
    "id" TEXT NOT NULL,
    "cvHash" TEXT NOT NULL,
    "parsedJson" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvParseCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CvParseCache_cvHash_key" ON "CvParseCache"("cvHash");

-- CreateIndex
CREATE INDEX "CvParseCache_cvHash_idx" ON "CvParseCache"("cvHash");

-- CreateIndex
CREATE INDEX "CvParseCache_createdAt_idx" ON "CvParseCache"("createdAt");
