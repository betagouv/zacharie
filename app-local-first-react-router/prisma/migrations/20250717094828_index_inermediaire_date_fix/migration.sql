-- DropIndex
DROP INDEX "CarcasseIntermediaire_fei_numero_created_at_idx";

-- DropIndex
DROP INDEX "CarcasseIntermediaire_prise_en_charge_at_created_at_idx";

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_fei_numero_prise_en_charge_at_created_idx" ON "CarcasseIntermediaire"("fei_numero", "prise_en_charge_at", "created_at");
