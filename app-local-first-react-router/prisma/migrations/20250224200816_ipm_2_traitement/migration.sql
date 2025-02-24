/*
  Warnings:

  - The `svi_ipm2_traitement_assainissant` column on the `Carcasse` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "IPM2Traitement" AS ENUM ('CUISSON', 'CONGELATION', 'AUTRE');

-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "svi_ipm2_traitement_assainissant_congelation_temp" TEXT,
ADD COLUMN     "svi_ipm2_traitement_assainissant_congelation_temps" TEXT,
ADD COLUMN     "svi_ipm2_traitement_assainissant_cuisson_temp" TEXT,
ADD COLUMN     "svi_ipm2_traitement_assainissant_cuisson_temps" TEXT,
ADD COLUMN     "svi_ipm2_traitement_assainissant_paramètres" TEXT,
ADD COLUMN     "svi_ipm2_traitement_assainissant_type" TEXT,
DROP COLUMN "svi_ipm2_traitement_assainissant",
ADD COLUMN     "svi_ipm2_traitement_assainissant" "IPM2Traitement"[];
