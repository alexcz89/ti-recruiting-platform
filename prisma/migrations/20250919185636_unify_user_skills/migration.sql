/*
  Warnings:

  - You are about to drop the column `ai` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `backend` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `cloud` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `cybersecurity` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `database` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `frontend` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `mobile` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `testing` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "ai",
DROP COLUMN "backend",
DROP COLUMN "cloud",
DROP COLUMN "cybersecurity",
DROP COLUMN "database",
DROP COLUMN "frontend",
DROP COLUMN "mobile",
DROP COLUMN "testing",
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
