/*
  Warnings:

  - A unique constraint covering the columns `[attemptId,questionId]` on the table `AttemptAnswer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AttemptAnswer_attemptId_questionId_key" ON "AttemptAnswer"("attemptId", "questionId");
