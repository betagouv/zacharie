/*
  Warnings:

  - You are about to drop the column `fei_id` on the `Carcasse` table. All the data in the column will be lost.
  - Added the required column `fei_numero` to the `Carcasse` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Carcasse" DROP CONSTRAINT "Carcasse_fei_id_fkey";

-- DropIndex
DROP INDEX "Carcasse_fei_id_numero_bracelet_idx";

-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "fei_id",
ADD COLUMN     "fei_numero" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Carcasse_fei_numero_numero_bracelet_idx" ON "Carcasse"("fei_numero", "numero_bracelet");

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE CASCADE ON UPDATE CASCADE;
