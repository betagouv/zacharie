-- Trichine : passage des références au format {E|P|F}-{YY}-{code établissement}-{séquence}.
--
-- Ancien format : {E|P|F}-{YY}-{séquence sur 6 chiffres}, séquence globale.
-- Nouveau format : le code établissement s'intercale, la séquence passe à 4 chiffres.
-- La séquence d'origine étant globale, elle reste unique une fois le code inséré : on la
-- conserve telle quelle plutôt que de renuméroter — les FTP déjà parties au laboratoire
-- portent ces numéros sur papier.
--
-- Code établissement : Entity.code_trichine (posé par la migration
-- 20260908120000_entity_code_trichine, à passer avant ce script) ; à défaut d'entité ou de
-- code, l'identifiant de l'utilisateur qui a fait l'acte — 5 caractères, déjà lisible.
--
-- Deux passes par table : le préfixe temporaire évite les collisions de contrainte @unique
-- pendant la réécriture.

BEGIN;

CREATE TEMP VIEW trichine_entity_code AS
SELECT
  e.id AS entity_id,
  NULLIF(upper(regexp_replace(e.code_trichine, '[^A-Za-z0-9]', '', 'g')), '') AS code
FROM "Entity" e;

-- La séquence est padée sur 4 chiffres sans jamais tronquer : lpad() coupe à droite au-delà
-- de la longueur demandée, ce qui écraserait les séquences à 5 chiffres et plus.
CREATE FUNCTION pg_temp.trichine_new_reference(reference text, code text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(reference, '-', 1) || '-' || split_part(reference, '-', 2) || '-' || code
         || '-' || lpad(seq, greatest(4, length(seq)), '0')
  FROM (SELECT ltrim(split_part(reference, '-', 3), '0') AS seq) s;
$$;

-- Échantillons : entité de prélèvement, à défaut le préleveur
UPDATE "TrichineEchantillon" ech
SET reference_echantillon = 'TMP-' || pg_temp.trichine_new_reference(
  ech.reference_echantillon,
  COALESCE(
    (SELECT code FROM trichine_entity_code WHERE entity_id = ech.preleve_par_entity_id),
    upper(ech.preleve_par_user_id)
  )
)
WHERE ech.reference_echantillon ~ '^E-\d{2}-\d{6}$';

UPDATE "TrichineEchantillon"
SET reference_echantillon = substring(reference_echantillon FROM 5)
WHERE reference_echantillon LIKE 'TMP-%';

-- Pools : entité créatrice, à défaut le créateur
UPDATE "TrichinePool" pool
SET reference_pool = 'TMP-' || pg_temp.trichine_new_reference(
  pool.reference_pool,
  COALESCE(
    (SELECT code FROM trichine_entity_code WHERE entity_id = pool.cree_par_entity_id),
    upper(pool.cree_par_user_id)
  )
)
WHERE pool.reference_pool ~ '^P-\d{2}-\d{6}$';

UPDATE "TrichinePool"
SET reference_pool = substring(reference_pool FROM 5)
WHERE reference_pool LIKE 'TMP-%';

-- FTP : entité expéditrice, à défaut l'expéditeur
UPDATE "TrichineFTP" ftp
SET numero_fiche = 'TMP-' || pg_temp.trichine_new_reference(
  ftp.numero_fiche,
  COALESCE(
    (SELECT code FROM trichine_entity_code WHERE entity_id = ftp.expediteur_entity_id),
    upper(ftp.expediteur_user_id)
  )
)
WHERE ftp.numero_fiche ~ '^F-\d{2}-\d{6}$';

UPDATE "TrichineFTP"
SET numero_fiche = substring(numero_fiche FROM 5)
WHERE numero_fiche LIKE 'TMP-%';

COMMIT;
