-- Code court de l'établissement, imprimé dans les références trichine
-- (E/P/F-{YY}-{code}-{séquence}). Distinct de code_etbt_certificat, qui sert
-- au numérotage des certificats ETG et ne doit pas bouger.
ALTER TABLE "Entity" ADD COLUMN "code_trichine" TEXT;

CREATE UNIQUE INDEX "Entity_code_trichine_key" ON "Entity"("code_trichine");

-- Attribution du code aux entités déjà en base : préfixe du type + compteur, dans l'ordre
-- de création. Même schéma que la génération applicative (nextEntityTrichineCode).
UPDATE "Entity" e
SET "code_trichine" = codes.code
FROM (
  SELECT
    id,
    prefix || lpad(row_number() OVER (PARTITION BY prefix ORDER BY created_at, id)::text, 2, '0') AS code
  FROM (
    SELECT
      id,
      created_at,
      CASE type
        WHEN 'PREMIER_DETENTEUR' THEN 'PD'
        WHEN 'COLLECTEUR_PRO' THEN 'CO'
        WHEN 'CCG' THEN 'CG'
        WHEN 'ETG' THEN 'EG'
        WHEN 'SVI' THEN 'SVI'
        WHEN 'COMMERCE_DE_DETAIL' THEN 'CD'
        WHEN 'CANTINE_OU_RESTAURATION_COLLECTIVE' THEN 'CR'
        WHEN 'ASSOCIATION_CARITATIVE' THEN 'AC'
        WHEN 'REPAS_DE_CHASSE_OU_ASSOCIATIF' THEN 'RC'
        WHEN 'CONSOMMATEUR_FINAL' THEN 'CF'
        WHEN 'LABORATOIRE' THEN 'LAB'
      END AS prefix
    FROM "Entity"
  ) prefixes
) codes
WHERE e.id = codes.id;
