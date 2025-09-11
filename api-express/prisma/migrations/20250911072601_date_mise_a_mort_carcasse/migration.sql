-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "date_mise_a_mort" DATE;

-- CreateIndex
CREATE INDEX "Carcasse_deleted_at_date_mise_a_mort_numero_bracelet_idx" ON "Carcasse"("deleted_at", "date_mise_a_mort", "numero_bracelet" DESC);
