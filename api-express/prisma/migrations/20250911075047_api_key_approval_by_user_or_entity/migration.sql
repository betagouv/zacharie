/*
  Warnings:

  - You are about to drop the `ApiKeyApprovalByUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ApiKeyApprovalByUser" DROP CONSTRAINT "ApiKeyApprovalByUser_api_key_id_fkey";

-- DropForeignKey
ALTER TABLE "ApiKeyApprovalByUser" DROP CONSTRAINT "ApiKeyApprovalByUser_user_id_fkey";

-- AlterTable
ALTER TABLE "ApiKeyLog" ADD COLUMN     "entity_id" TEXT;

-- DropTable
DROP TABLE "ApiKeyApprovalByUser";

-- CreateTable
CREATE TABLE "ApiKeyApprovalByUserOrEntity" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_id" TEXT,
    "status" "ApiKeyApprovalStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyApprovalByUserOrEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiKeyApprovalByUserOrEntity_api_key_id_status_idx" ON "ApiKeyApprovalByUserOrEntity"("api_key_id", "status");

-- CreateIndex
CREATE INDEX "ApiKeyApprovalByUserOrEntity_user_id_status_idx" ON "ApiKeyApprovalByUserOrEntity"("user_id", "status");

-- CreateIndex
CREATE INDEX "ApiKeyApprovalByUserOrEntity_entity_id_status_idx" ON "ApiKeyApprovalByUserOrEntity"("entity_id", "status");

-- AddForeignKey
ALTER TABLE "ApiKeyApprovalByUserOrEntity" ADD CONSTRAINT "ApiKeyApprovalByUserOrEntity_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyApprovalByUserOrEntity" ADD CONSTRAINT "ApiKeyApprovalByUserOrEntity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyApprovalByUserOrEntity" ADD CONSTRAINT "ApiKeyApprovalByUserOrEntity_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyLog" ADD CONSTRAINT "ApiKeyLog_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
