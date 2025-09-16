/*
  Warnings:

  - A unique constraint covering the columns `[api_key_id,entity_id,status]` on the table `ApiKeyApprovalByUserOrEntity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[api_key_id,user_id,status]` on the table `ApiKeyApprovalByUserOrEntity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ApiKeyApprovalByUserOrEntity_api_key_id_user_id_entity_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyApprovalByUserOrEntity_api_key_id_entity_id_status_key" ON "ApiKeyApprovalByUserOrEntity"("api_key_id", "entity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyApprovalByUserOrEntity_api_key_id_user_id_status_key" ON "ApiKeyApprovalByUserOrEntity"("api_key_id", "user_id", "status");
