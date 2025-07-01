-- CreateIndex
CREATE INDEX "Entity_updated_at_idx" ON "Entity"("updated_at");

-- CreateIndex
CREATE INDEX "Entity_nom_d_usage_idx" ON "Entity"("nom_d_usage");

-- CreateIndex
CREATE INDEX "Entity_type_zacharie_compatible_nom_d_usage_idx" ON "Entity"("type", "zacharie_compatible", "nom_d_usage");

-- CreateIndex
CREATE INDEX "Entity_for_testing_updated_at_idx" ON "Entity"("for_testing", "updated_at");

-- CreateIndex
CREATE INDEX "Entity_type_updated_at_idx" ON "Entity"("type", "updated_at");

-- CreateIndex
CREATE INDEX "User_roles_idx" ON "User"("roles");

-- CreateIndex
CREATE INDEX "User_updated_at_idx" ON "User"("updated_at");

-- CreateIndex
CREATE INDEX "User_last_seen_at_idx" ON "User"("last_seen_at");

-- CreateIndex
CREATE INDEX "User_roles_updated_at_idx" ON "User"("roles", "updated_at");
