/*
  Warnings:

  - The `svi_carcasse_saisie` column on the `Carcasse` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "svi_carcasse_saisie",
ADD COLUMN     "svi_carcasse_saisie" TEXT[];

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "nom_d_usage" TEXT;
