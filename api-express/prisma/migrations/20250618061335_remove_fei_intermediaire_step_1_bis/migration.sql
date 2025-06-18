/*
  Warnings:

  - You are about to drop the column `fei_intermediaire_role` on the `CarcasseIntermediaire` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP COLUMN "fei_intermediaire_role",
ADD COLUMN     "id" TEXT,
ADD COLUMN     "intermediaire_entity_id" TEXT,
ADD COLUMN     "intermediaire_id" TEXT,
ADD COLUMN     "intermediaire_role" "UserRoles",
ADD COLUMN     "intermediaire_user_id" TEXT;
