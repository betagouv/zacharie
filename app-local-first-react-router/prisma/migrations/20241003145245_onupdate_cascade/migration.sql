/*
  Warnings:

  - The primary key for the `Carcasse` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `CarcasseIntermediaire` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[numero_bracelet]` on the table `Carcasse` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fei_numero__bracelet__intermediaire_id]` on the table `CarcasseIntermediaire` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `Carcasse` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `CarcasseIntermediaire` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey";

-- DropForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" DROP CONSTRAINT "_FeiIntermediairesCarcasse_A_fkey";

-- AlterTable
ALTER TABLE "Carcasse" DROP CONSTRAINT "Carcasse_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "Carcasse_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "CarcasseIntermediaire_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "Carcasse_numero_bracelet_key" ON "Carcasse"("numero_bracelet");

-- CreateIndex
CREATE UNIQUE INDEX "CarcasseIntermediaire_fei_numero__bracelet__intermediaire_i_key" ON "CarcasseIntermediaire"("fei_numero__bracelet__intermediaire_id");

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey" FOREIGN KEY ("numero_bracelet") REFERENCES "Carcasse"("numero_bracelet") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" ADD CONSTRAINT "_FeiIntermediairesCarcasse_A_fkey" FOREIGN KEY ("A") REFERENCES "Carcasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
