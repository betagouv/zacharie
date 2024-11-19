-- DropIndex
DROP INDEX "Fei_svi_entity_id_idx";

-- DropIndex
DROP INDEX "Fei_svi_user_id_idx";

-- DropIndex
DROP INDEX "FeiIntermediaire_fei_numero_fei_intermediaire_user_id_fei_i_idx";

-- CreateIndex
CREATE INDEX "EntityRelations_owner_id_entity_id_idx" ON "EntityRelations"("owner_id", "entity_id");

-- CreateIndex
CREATE INDEX "FeiIntermediaire_fei_numero_fei_intermediaire_user_id_idx" ON "FeiIntermediaire"("fei_numero", "fei_intermediaire_user_id");

-- CreateIndex
CREATE INDEX "FeiIntermediaire_fei_intermediaire_entity_id_idx" ON "FeiIntermediaire"("fei_intermediaire_entity_id");
