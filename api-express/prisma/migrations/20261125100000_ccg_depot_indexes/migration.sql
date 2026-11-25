-- CreateIndex
CREATE INDEX "Carcasse_premier_detenteur_depot_entity_id_updated_at_idx" ON "Carcasse"("premier_detenteur_depot_entity_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_intermediaire_depot_entity_id_carcass_idx" ON "CarcasseIntermediaire"("intermediaire_depot_entity_id", "carcasse_updated_at" DESC, "zacharie_carcasse_id" DESC);
