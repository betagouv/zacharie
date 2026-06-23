-- Indexes pour accélérer GET /carcasse (cf src/controllers/carcasse.ts).
-- Mesuré en prod : le OR sur les colonnes de propriété fait un seq scan (~4s, count+findMany),
-- et le chargement des intermédiaires par carcasse fait un seq scan (~1.7s).
-- Migration jouée pendant une fenêtre sans trafic, donc CREATE INDEX simple (verrou bref) suffit.

-- CreateIndex
CREATE INDEX "Carcasse_svi_entity_id_updated_at_idx" ON "Carcasse"("svi_entity_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_next_owner_entity_id_updated_at_idx" ON "Carcasse"("next_owner_entity_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_current_owner_entity_id_updated_at_idx" ON "Carcasse"("current_owner_entity_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_premier_detenteur_entity_id_updated_at_idx" ON "Carcasse"("premier_detenteur_entity_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_prev_owner_entity_id_updated_at_idx" ON "Carcasse"("prev_owner_entity_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_premier_detenteur_user_id_updated_at_idx" ON "Carcasse"("premier_detenteur_user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_examinateur_initial_user_id_updated_at_idx" ON "Carcasse"("examinateur_initial_user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_current_owner_user_id_updated_at_idx" ON "Carcasse"("current_owner_user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_next_owner_user_id_updated_at_idx" ON "Carcasse"("next_owner_user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_prev_owner_user_id_updated_at_idx" ON "Carcasse"("prev_owner_user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_zacharie_carcasse_id_idx" ON "CarcasseIntermediaire"("zacharie_carcasse_id");
