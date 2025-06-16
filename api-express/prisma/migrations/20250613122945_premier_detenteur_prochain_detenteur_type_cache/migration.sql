/*
  Warnings:

  - You are about to drop the column `premier_detenteur_prochain_detenteur_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_prochain_detenteur_type` on the `Fei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "premier_detenteur_prochain_detenteur_id",
DROP COLUMN "premier_detenteur_prochain_detenteur_type",
ADD COLUMN     "premier_detenteur_prochain_detenteur_id_cache" TEXT,
ADD COLUMN     "premier_detenteur_prochain_detenteur_type_cache" "EntityTypes";
