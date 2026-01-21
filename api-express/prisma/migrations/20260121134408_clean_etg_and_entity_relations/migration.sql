/*
  Warnings:

  - You are about to drop the `ETGAndEntityRelations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ETGAndEntityRelations" DROP CONSTRAINT "ETGAndEntityRelations_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "ETGAndEntityRelations" DROP CONSTRAINT "ETGAndEntityRelations_etg_id_fkey";

-- DropTable
DROP TABLE "ETGAndEntityRelations";
