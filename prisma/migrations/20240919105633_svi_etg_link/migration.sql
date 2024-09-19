/*
  Warnings:

  - You are about to drop the column `etg_check_finished_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `etg_commentaire` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `etg_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `etg_received_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `etg_user_id` on the `Fei` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[etg_linked_with_svi_id]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[svi_linked_with_etg_id]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_etg_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_etg_user_id_fkey";

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "etg_linked_with_svi_id" TEXT,
ADD COLUMN     "svi_linked_with_etg_id" TEXT;

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "etg_check_finished_at",
DROP COLUMN "etg_commentaire",
DROP COLUMN "etg_entity_id",
DROP COLUMN "etg_received_at",
DROP COLUMN "etg_user_id";

-- CreateIndex
CREATE UNIQUE INDEX "Entity_etg_linked_with_svi_id_key" ON "Entity"("etg_linked_with_svi_id");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_svi_linked_with_etg_id_key" ON "Entity"("svi_linked_with_etg_id");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_etg_linked_with_svi_id_fkey" FOREIGN KEY ("etg_linked_with_svi_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_svi_linked_with_etg_id_fkey" FOREIGN KEY ("svi_linked_with_etg_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
