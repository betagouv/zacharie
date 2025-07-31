/*
  Warnings:

  - You are about to drop the column `premier_detenteur_prochain_detenteur_type_cache` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `intermediaire_prochain_detenteur_type_cache` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_prochain_detenteur_type_cache` on the `Fei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "premier_detenteur_prochain_detenteur_type_cache";

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP COLUMN "intermediaire_prochain_detenteur_type_cache";

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "premier_detenteur_prochain_detenteur_type_cache";
