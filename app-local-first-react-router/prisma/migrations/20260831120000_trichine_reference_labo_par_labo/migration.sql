-- La référence interne du laboratoire n'appartient pas au pool mais au couple pool ↔ laboratoire
-- destinataire : le LVD et le LNR ont chacun la leur, aucun ne voit celle de l'autre.
ALTER TABLE "TrichinePoolFTP" ADD COLUMN "reference_labo" TEXT;

-- Reprise : la référence portée par le pool était celle du dernier laboratoire l'ayant reçu.
UPDATE "TrichinePoolFTP" AS lien
SET "reference_labo" = pool."reference_labo"
FROM "TrichinePool" AS pool
WHERE pool."id" = lien."pool_id"
  AND pool."reference_labo" IS NOT NULL
  AND lien."id" = (
    SELECT autre."id"
    FROM "TrichinePoolFTP" AS autre
    WHERE autre."pool_id" = pool."id"
    ORDER BY autre."date_ajout" DESC
    LIMIT 1
  );

ALTER TABLE "TrichinePool" DROP COLUMN "reference_labo";
