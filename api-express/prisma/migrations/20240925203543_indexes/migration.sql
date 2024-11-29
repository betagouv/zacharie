-- DropIndex
DROP INDEX "User_email_prenom_nom_de_famille_roles_idx";

-- CreateIndex
CREATE INDEX "Fei_svi_signed_at_idx" ON "Fei"("svi_signed_at");

-- CreateIndex
CREATE INDEX "Fei_fei_next_owner_user_id_idx" ON "Fei"("fei_next_owner_user_id");

-- CreateIndex
CREATE INDEX "Fei_fei_next_owner_entity_id_idx" ON "Fei"("fei_next_owner_entity_id");

-- CreateIndex
CREATE INDEX "Fei_fei_current_owner_user_id_idx" ON "Fei"("fei_current_owner_user_id");

-- CreateIndex
CREATE INDEX "Fei_fei_current_owner_entity_id_idx" ON "Fei"("fei_current_owner_entity_id");

-- CreateIndex
CREATE INDEX "Fei_updated_at_idx" ON "Fei"("updated_at");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "User"("id");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_onboarded_at_idx" ON "User"("onboarded_at");
