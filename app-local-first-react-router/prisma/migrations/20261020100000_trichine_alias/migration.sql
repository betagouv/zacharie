-- CreateEnum
CREATE TYPE "TrichineAliasObjet" AS ENUM ('ECHANTILLON', 'POOL', 'FTP');

-- CreateTable
CREATE TABLE "TrichineAlias" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "objet_type" "TrichineAliasObjet" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "echantillon_id" TEXT,
    "pool_id" TEXT,
    "ftp_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrichineAlias_pkey" PRIMARY KEY ("id"),
    -- Exactement une FK remplie, celle qui correspond au type d'objet
    CONSTRAINT "TrichineAlias_objet_check" CHECK (
        ("objet_type" = 'ECHANTILLON' AND "echantillon_id" IS NOT NULL AND "pool_id" IS NULL AND "ftp_id" IS NULL)
        OR ("objet_type" = 'POOL' AND "pool_id" IS NOT NULL AND "echantillon_id" IS NULL AND "ftp_id" IS NULL)
        OR ("objet_type" = 'FTP' AND "ftp_id" IS NOT NULL AND "echantillon_id" IS NULL AND "pool_id" IS NULL)
    )
);

-- CreateIndex
CREATE INDEX "TrichineAlias_echantillon_id_idx" ON "TrichineAlias"("echantillon_id");

-- CreateIndex
CREATE INDEX "TrichineAlias_pool_id_idx" ON "TrichineAlias"("pool_id");

-- CreateIndex
CREATE INDEX "TrichineAlias_ftp_id_idx" ON "TrichineAlias"("ftp_id");

-- CreateIndex
CREATE UNIQUE INDEX "TrichineAlias_entity_id_echantillon_id_key" ON "TrichineAlias"("entity_id", "echantillon_id");

-- CreateIndex
CREATE UNIQUE INDEX "TrichineAlias_entity_id_pool_id_key" ON "TrichineAlias"("entity_id", "pool_id");

-- CreateIndex
CREATE UNIQUE INDEX "TrichineAlias_entity_id_ftp_id_key" ON "TrichineAlias"("entity_id", "ftp_id");

-- CreateIndex
CREATE UNIQUE INDEX "TrichineAlias_entity_id_objet_type_reference_key" ON "TrichineAlias"("entity_id", "objet_type", "reference");

-- AddForeignKey
ALTER TABLE "TrichineAlias" ADD CONSTRAINT "TrichineAlias_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineAlias" ADD CONSTRAINT "TrichineAlias_echantillon_id_fkey" FOREIGN KEY ("echantillon_id") REFERENCES "TrichineEchantillon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineAlias" ADD CONSTRAINT "TrichineAlias_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "TrichinePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineAlias" ADD CONSTRAINT "TrichineAlias_ftp_id_fkey" FOREIGN KEY ("ftp_id") REFERENCES "TrichineFTP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des n° internes de laboratoire : celui posé par le labo destinataire sur le lien
-- pool ↔ FTP devient l'alias du pool pour ce labo. Un même labo lié deux fois au même pool
-- garde le plus récent ; une référence déjà prise par ce labo pour un autre pool est ignorée.
INSERT INTO "TrichineAlias" ("id", "reference", "objet_type", "entity_id", "pool_id", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "reference", 'POOL', "entity_id", "pool_id", "date_ajout", "date_ajout"
FROM (
    SELECT DISTINCT ON (ftp."destinataire_entity_id", lien."pool_id")
        btrim(lien."reference_labo") AS "reference",
        ftp."destinataire_entity_id" AS "entity_id",
        lien."pool_id",
        lien."date_ajout"
    FROM "TrichinePoolFTP" lien
    JOIN "TrichineFTP" ftp ON ftp."id" = lien."ftp_id"
    WHERE btrim(coalesce(lien."reference_labo", '')) <> ''
    ORDER BY ftp."destinataire_entity_id", lien."pool_id", lien."date_ajout" DESC
) reprise
ON CONFLICT DO NOTHING;

-- AlterTable
ALTER TABLE "TrichinePoolFTP" DROP COLUMN "reference_labo";
