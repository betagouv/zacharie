-- AlterTable
ALTER TABLE "ApiKeyApprovalByUserOrEntity" ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "access_token_created_at" TIMESTAMP(3);
