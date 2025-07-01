-- CreateIndex
CREATE INDEX "Carcasse_deleted_at_created_at_idx" ON "Carcasse"("deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "Carcasse_numero_bracelet_idx" ON "Carcasse"("numero_bracelet");

-- CreateIndex
CREATE INDEX "Carcasse_deleted_at_updated_at_idx" ON "Carcasse"("deleted_at", "updated_at");

-- CreateIndex
CREATE INDEX "Carcasse_intermediaire_carcasse_refus_intermediaire_id_idx" ON "Carcasse"("intermediaire_carcasse_refus_intermediaire_id");

-- CreateIndex
CREATE INDEX "Carcasse_intermediaire_carcasse_manquante_idx" ON "Carcasse"("intermediaire_carcasse_manquante");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_commentaire_idx" ON "CarcasseIntermediaire"("commentaire");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_created_at_idx" ON "CarcasseIntermediaire"("created_at");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_intermediaire_entity_id_idx" ON "CarcasseIntermediaire"("intermediaire_entity_id");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_intermediaire_user_id_idx" ON "CarcasseIntermediaire"("intermediaire_user_id");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_fei_numero_created_at_idx" ON "CarcasseIntermediaire"("fei_numero", "created_at");

-- CreateIndex
CREATE INDEX "Fei_svi_assigned_at_idx" ON "Fei"("svi_assigned_at");

-- CreateIndex
CREATE INDEX "Fei_svi_entity_id_svi_assigned_at_idx" ON "Fei"("svi_entity_id", "svi_assigned_at");

-- CreateIndex
CREATE INDEX "Fei_automatic_closed_at_svi_closed_at_svi_assigned_at_idx" ON "Fei"("automatic_closed_at", "svi_closed_at", "svi_assigned_at");

-- CreateIndex
CREATE INDEX "Fei_deleted_at_created_at_idx" ON "Fei"("deleted_at", "created_at");
