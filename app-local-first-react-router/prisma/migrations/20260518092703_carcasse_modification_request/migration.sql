-- CreateEnum
CREATE TYPE "CarcasseModificationRequestType" AS ENUM ('BRACELET_RENAME', 'NEW_CARCASSE');

-- CreateEnum
CREATE TYPE "CarcasseModificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CarcasseModificationRequest" (
    "id" TEXT NOT NULL,
    "type" "CarcasseModificationRequestType" NOT NULL,
    "status" "CarcasseModificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "zacharie_carcasse_id" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "requested_by_entity_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment_intermediaire" TEXT,
    "numero_bracelet_before" TEXT,
    "numero_bracelet_after" TEXT,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CarcasseModificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarcasseModificationRequest_zacharie_carcasse_id_idx" ON "CarcasseModificationRequest"("zacharie_carcasse_id");

-- CreateIndex
CREATE INDEX "CarcasseModificationRequest_reviewed_by_user_id_status_idx" ON "CarcasseModificationRequest"("reviewed_by_user_id", "status");

-- AddForeignKey
ALTER TABLE "CarcasseModificationRequest" ADD CONSTRAINT "CarcasseModificationRequest_zacharie_carcasse_id_fkey" FOREIGN KEY ("zacharie_carcasse_id") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseModificationRequest" ADD CONSTRAINT "CarcasseModificationRequest_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseModificationRequest" ADD CONSTRAINT "CarcasseModificationRequest_requested_by_entity_id_fkey" FOREIGN KEY ("requested_by_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseModificationRequest" ADD CONSTRAINT "CarcasseModificationRequest_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
