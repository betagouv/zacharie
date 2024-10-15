/*
  Warnings:

  - You are about to drop the column `examinateur_refus` on the `Carcasse` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey";

-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "examinateur_refus";

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey" FOREIGN KEY ("numero_bracelet") REFERENCES "Carcasse"("numero_bracelet") ON DELETE CASCADE ON UPDATE CASCADE;
