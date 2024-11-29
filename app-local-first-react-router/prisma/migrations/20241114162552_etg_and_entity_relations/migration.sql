/*
  Warnings:

  - You are about to drop the `EntityRelations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EntityRelations" DROP CONSTRAINT "EntityRelations_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "EntityRelations" DROP CONSTRAINT "EntityRelations_owner_id_fkey";

-- DropTable
DROP TABLE "EntityRelations";

-- CreateTable
CREATE TABLE "EntityAndUserRelations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relation" "EntityRelationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "EntityAndUserRelations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ETGAndEntityRelations" (
    "etg_id_entity_id" TEXT NOT NULL,
    "etg_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_type" "EntityTypes" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ETGAndEntityRelations_pkey" PRIMARY KEY ("etg_id_entity_id")
);

-- CreateIndex
CREATE INDEX "EntityAndUserRelations_owner_id_relation_idx" ON "EntityAndUserRelations"("owner_id", "relation");

-- CreateIndex
CREATE INDEX "EntityAndUserRelations_entity_id_relation_idx" ON "EntityAndUserRelations"("entity_id", "relation");

-- CreateIndex
CREATE INDEX "EntityAndUserRelations_owner_id_entity_id_idx" ON "EntityAndUserRelations"("owner_id", "entity_id");

-- CreateIndex
CREATE INDEX "ETGAndEntityRelations_etg_id_entity_type_idx" ON "ETGAndEntityRelations"("etg_id", "entity_type");

-- CreateIndex
CREATE INDEX "ETGAndEntityRelations_entity_id_entity_type_idx" ON "ETGAndEntityRelations"("entity_id", "entity_type");

-- AddForeignKey
ALTER TABLE "EntityAndUserRelations" ADD CONSTRAINT "EntityAndUserRelations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAndUserRelations" ADD CONSTRAINT "EntityAndUserRelations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ETGAndEntityRelations" ADD CONSTRAINT "ETGAndEntityRelations_etg_id_fkey" FOREIGN KEY ("etg_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ETGAndEntityRelations" ADD CONSTRAINT "ETGAndEntityRelations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
