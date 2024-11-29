/*
  Warnings:

  - You are about to drop the column `zacharie_id` on the `Carcasse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "zacharie_id",
ADD COLUMN     "zacharie_carcasse_id" TEXT;

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ADD COLUMN     "fei_numero__zacharie_carcasse_id__intermediaire_id" TEXT,
ADD COLUMN     "zacharie_carcasse_id" TEXT;
