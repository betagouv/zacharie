/*
  Warnings:

  - You are about to drop the column `etg_linked_with_svi_id` on the `Entity` table. All the data in the column will be lost.
  - You are about to drop the column `svi_linked_with_etg_id` on the `Entity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[coupled_entity_id]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Entity" DROP CONSTRAINT "Entity_etg_linked_with_svi_id_fkey";

-- DropForeignKey
ALTER TABLE "Entity" DROP CONSTRAINT "Entity_svi_linked_with_etg_id_fkey";

-- DropIndex
DROP INDEX "Entity_etg_linked_with_svi_id_key";

-- DropIndex
DROP INDEX "Entity_svi_linked_with_etg_id_key";

-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "etg_linked_with_svi_id",
DROP COLUMN "svi_linked_with_etg_id",
ADD COLUMN     "coupled_entity_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Entity_coupled_entity_id_key" ON "Entity"("coupled_entity_id");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_coupled_entity_id_fkey" FOREIGN KEY ("coupled_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
