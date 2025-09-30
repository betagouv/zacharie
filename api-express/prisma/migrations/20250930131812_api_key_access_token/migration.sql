/*
  Warnings:

  - A unique constraint covering the columns `[access_token]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "access_token_read_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_access_token_key" ON "ApiKey"("access_token");
