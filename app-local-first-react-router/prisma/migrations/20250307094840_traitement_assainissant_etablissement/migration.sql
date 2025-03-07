/*
  Warnings:

  - You are about to drop the column `svi_ipm2_traitement_assainissant_siret` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `adresse_etg` on the `CarcasseCertificat` table. All the data in the column will be lost.
  - You are about to drop the column `siret_etg` on the `CarcasseCertificat` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "svi_ipm2_traitement_assainissant_siret";

-- AlterTable
ALTER TABLE "CarcasseCertificat" DROP COLUMN "adresse_etg",
DROP COLUMN "siret_etg",
ADD COLUMN     "traitement_assainissant_etablissement" TEXT;
