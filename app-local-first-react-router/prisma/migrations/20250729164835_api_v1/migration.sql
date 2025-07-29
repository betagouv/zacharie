-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('FEI_READ_FOR_USER', 'FEI_READ_FOR_ENTITY', 'CARCASSE_READ_FOR_USER', 'CARCASSE_READ_FOR_ENTITY');

-- CreateEnum
CREATE TYPE "ApiKeyApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApiKeyLogAction" AS ENUM ('CREATED', 'USED', 'REVOKED', 'EXPIRED', 'UPDATED', 'RATE_LIMITED', 'INVALID_SCOPE');

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "scopes" "ApiKeyScope"[],
    "rate_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyApprovalByUser" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "ApiKeyApprovalStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyApprovalByUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyLog" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "ApiKeyLogAction" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "endpoint" TEXT,
    "status_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_private_key_key" ON "ApiKey"("private_key");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_public_key_key" ON "ApiKey"("public_key");

-- CreateIndex
CREATE INDEX "ApiKey_active_expires_at_idx" ON "ApiKey"("active", "expires_at");

-- CreateIndex
CREATE INDEX "ApiKey_last_used_at_idx" ON "ApiKey"("last_used_at");

-- CreateIndex
CREATE INDEX "ApiKeyApprovalByUser_api_key_id_status_idx" ON "ApiKeyApprovalByUser"("api_key_id", "status");

-- CreateIndex
CREATE INDEX "ApiKeyApprovalByUser_user_id_status_idx" ON "ApiKeyApprovalByUser"("user_id", "status");

-- CreateIndex
CREATE INDEX "ApiKeyLog_api_key_id_created_at_idx" ON "ApiKeyLog"("api_key_id", "created_at");

-- CreateIndex
CREATE INDEX "ApiKeyLog_user_id_created_at_idx" ON "ApiKeyLog"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyApprovalByUser" ADD CONSTRAINT "ApiKeyApprovalByUser_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyApprovalByUser" ADD CONSTRAINT "ApiKeyApprovalByUser_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyLog" ADD CONSTRAINT "ApiKeyLog_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyLog" ADD CONSTRAINT "ApiKeyLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
