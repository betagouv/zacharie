-- CreateIndex
CREATE INDEX "ETGAndEntityRelations_etg_id_updated_at_idx" ON "ETGAndEntityRelations"("etg_id", "updated_at");

-- CreateIndex
CREATE INDEX "ETGAndEntityRelations_entity_id_updated_at_idx" ON "ETGAndEntityRelations"("entity_id", "updated_at");

-- CreateIndex
CREATE INDEX "EntityAndUserRelations_owner_id_updated_at_idx" ON "EntityAndUserRelations"("owner_id", "updated_at");
