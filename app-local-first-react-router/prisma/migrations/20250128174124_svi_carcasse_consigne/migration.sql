/*
  Warnings:

  - The `svi_carcasse_saisie` column on the `Carcasse` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "svi_carcasse_consigne" BOOLEAN,
ADD COLUMN     "svi_carcasse_consigne_at" TIMESTAMP(3),
ADD COLUMN     "svi_carcasse_consigne_levee" BOOLEAN,
ADD COLUMN     "svi_carcasse_consigne_levee_at" TIMESTAMP(3),
ADD COLUMN     "svi_carcasse_consigne_motif" TEXT[];
