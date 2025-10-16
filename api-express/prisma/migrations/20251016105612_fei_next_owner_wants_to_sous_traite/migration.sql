/*
  Warnings:

  - You are about to drop the column `fei_next_owner_sous_traite` on the `Fei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "fei_next_owner_sous_traite",
ADD COLUMN     "fei_next_owner_sous_traite_at" TIMESTAMP(3),
ADD COLUMN     "fei_next_owner_sous_traite_by_entity_id" TEXT,
ADD COLUMN     "fei_next_owner_sous_traite_by_user_id" TEXT,
ADD COLUMN     "fei_next_owner_wants_to_sous_traite" BOOLEAN;
