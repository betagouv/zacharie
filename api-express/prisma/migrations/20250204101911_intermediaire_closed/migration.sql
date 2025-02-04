-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "intermediaire_closed_at" TIMESTAMP(3),
ADD COLUMN     "intermediaire_closed_by_entity_id" TEXT,
ADD COLUMN     "intermediaire_closed_by_user_id" TEXT;
