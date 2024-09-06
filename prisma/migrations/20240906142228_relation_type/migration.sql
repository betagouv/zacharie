/*
  Warnings:

  - Added the required column `relation` to the `EntityRelations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `relation` to the `UserRelations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('WORKING_FOR', 'WORKING_WITH');

-- AlterTable
ALTER TABLE "EntityRelations" DROP COLUMN "relation",
ADD COLUMN     "relation" "RelationType" NOT NULL;

-- AlterTable
ALTER TABLE "UserRelations" DROP COLUMN "relation",
ADD COLUMN     "relation" "RelationType" NOT NULL;

-- CreateIndex
CREATE INDEX "EntityRelations_owner_id_relation_idx" ON "EntityRelations"("owner_id", "relation");

-- CreateIndex
CREATE INDEX "EntityRelations_entity_id_relation_idx" ON "EntityRelations"("entity_id", "relation");

-- CreateIndex
CREATE INDEX "UserRelations_owner_id_relation_idx" ON "UserRelations"("owner_id", "relation");
