/*
  Warnings:

  - The primary key for the `CarcasseIntermediaire` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[fei_numero,zacharie_carcasse_id,intermediaire_id]` on the table `CarcasseIntermediaire` will be added. If there are existing duplicate values, this will fail.
  - Made the column `id` on table `CarcasseIntermediaire` required. This step will fail if there are existing NULL values in that column.
  - Made the column `intermediaire_entity_id` on table `CarcasseIntermediaire` required. This step will fail if there are existing NULL values in that column.
  - Made the column `intermediaire_id` on table `CarcasseIntermediaire` required. This step will fail if there are existing NULL values in that column.
  - Made the column `intermediaire_user_id` on table `CarcasseIntermediaire` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_id_fkey";

-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_carcasse_intermediaire_id_fkey";

-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_fei_intermediaire_id_fkey";

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_pkey",
ALTER COLUMN "fei_numero__bracelet__intermediaire_id" DROP NOT NULL,
ALTER COLUMN "fei_intermediaire_id" DROP NOT NULL,
ALTER COLUMN "fei_intermediaire_user_id" DROP NOT NULL,
ALTER COLUMN "fei_intermediaire_entity_id" DROP NOT NULL,
ALTER COLUMN "id" SET NOT NULL,
ALTER COLUMN "intermediaire_entity_id" SET NOT NULL,
ALTER COLUMN "intermediaire_id" SET NOT NULL,
ALTER COLUMN "intermediaire_user_id" SET NOT NULL,
ADD CONSTRAINT "CarcasseIntermediaire_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Log" ADD COLUMN     "feiIntermediaireId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CarcasseIntermediaire_fei_numero_zacharie_carcasse_id_inter_key" ON "CarcasseIntermediaire"("fei_numero", "zacharie_carcasse_id", "intermediaire_id");

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_feiIntermediaireId_fkey" FOREIGN KEY ("feiIntermediaireId") REFERENCES "FeiIntermediaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_intermediaire_user_id_fkey" FOREIGN KEY ("intermediaire_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_intermediaire_entity_id_fkey" FOREIGN KEY ("intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
