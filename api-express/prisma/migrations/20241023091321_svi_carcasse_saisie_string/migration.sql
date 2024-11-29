/*
  Warnings:

  - You are about to drop the column `svi_carcasse_saisie_partielle` on the `Carcasse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "svi_carcasse_saisie_partielle",
ALTER COLUMN "svi_carcasse_saisie" SET DATA TYPE TEXT;
