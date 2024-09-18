/*
  Warnings:

  - A unique constraint covering the columns `[fei_numero__bracelet__intermediaire_id]` on the table `CarcasseIntermediaire` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fei_numero__bracelet__intermediaire_id` to the `CarcasseIntermediaire` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CarcasseIntermediaire_fei_numero_numero_bracelet_fei_interm_idx";

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ADD COLUMN     "fei_numero__bracelet__intermediaire_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CarcasseIntermediaire_fei_numero__bracelet__intermediaire_i_key" ON "CarcasseIntermediaire"("fei_numero__bracelet__intermediaire_id");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_fei_numero__bracelet__intermediaire_i_idx" ON "CarcasseIntermediaire"("fei_numero__bracelet__intermediaire_id");
