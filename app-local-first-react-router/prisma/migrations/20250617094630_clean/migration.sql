/*
  Warnings:

  - You are about to drop the column `premier_detenteur_date_depot_quelque_part` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_aucune_carcasse_saisie` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasses_saisies` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_commentaire` on the `Fei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "premier_detenteur_date_depot_quelque_part",
DROP COLUMN "svi_aucune_carcasse_saisie",
DROP COLUMN "svi_carcasses_saisies",
DROP COLUMN "svi_commentaire",
ADD COLUMN     "svi_closed_at" TIMESTAMP(3),
ADD COLUMN     "svi_closed_by_user_id" TEXT;
