-- CreateTable
CREATE TABLE "AutoLoginToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoLoginToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoLoginToken_token_key" ON "AutoLoginToken"("token");

-- CreateIndex
CREATE INDEX "AutoLoginToken_token_idx" ON "AutoLoginToken"("token");

-- CreateIndex
CREATE INDEX "AutoLoginToken_userId_idx" ON "AutoLoginToken"("userId");

-- AddForeignKey
ALTER TABLE "AutoLoginToken" ADD CONSTRAINT "AutoLoginToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
