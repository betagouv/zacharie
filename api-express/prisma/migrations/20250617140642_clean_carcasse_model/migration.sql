/*
  Warnings:

  - You are about to drop the column `svi_carcasse_saisie` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_saisie_at` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_saisie_motif` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_carcasse_signed_at` on the `Carcasse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "svi_carcasse_saisie",
DROP COLUMN "svi_carcasse_saisie_at",
DROP COLUMN "svi_carcasse_saisie_motif",
DROP COLUMN "svi_carcasse_signed_at";
