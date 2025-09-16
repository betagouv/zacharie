/*
  Warnings:

  - A unique constraint covering the columns `[api_key_id,user_id,entity_id]` on the table `ApiKeyApprovalByUserOrEntity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyApprovalByUserOrEntity_api_key_id_user_id_entity_id_key" ON "ApiKeyApprovalByUserOrEntity"("api_key_id", "user_id", "entity_id");
