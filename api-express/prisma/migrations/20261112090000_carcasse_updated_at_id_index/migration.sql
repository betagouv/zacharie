-- CreateIndex
-- CONCURRENTLY : ne bloque pas les écritures sur Carcasse pendant la construction de l'index.
-- Seule instruction du fichier : Prisma ne l'exécute donc pas dans une transaction.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Carcasse_updated_at_zacharie_carcasse_id_idx" ON "Carcasse"("updated_at" DESC, "zacharie_carcasse_id" DESC);
