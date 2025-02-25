/*
  Warnings:

  - You are about to drop the column `svi_carcasse_consigne` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_consigne_at` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_consigne_levee` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_consigne_levee_at` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_consigne_motif` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_manquante` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_saisie_partielle` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_saisie_partielle_morceaux` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_saisie_partielle_nombre_animaux` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_traitement_assainissant` on the `Carcasse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "svi_carcasse_consigne",
DROP COLUMN "svi_carcasse_consigne_at",
DROP COLUMN "svi_carcasse_consigne_levee",
DROP COLUMN "svi_carcasse_consigne_levee_at",
DROP COLUMN "svi_carcasse_consigne_motif",
DROP COLUMN "svi_carcasse_manquante",
DROP COLUMN "svi_carcasse_saisie_partielle",
DROP COLUMN "svi_carcasse_saisie_partielle_morceaux",
DROP COLUMN "svi_carcasse_saisie_partielle_nombre_animaux",
DROP COLUMN "svi_carcasse_traitement_assainissant";
