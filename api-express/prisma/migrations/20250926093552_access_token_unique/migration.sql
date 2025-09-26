/*
  Warnings:

  - A unique constraint covering the columns `[access_token]` on the table `ApiKeyApprovalByUserOrEntity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyApprovalByUserOrEntity_access_token_key" ON "ApiKeyApprovalByUserOrEntity"("access_token");
