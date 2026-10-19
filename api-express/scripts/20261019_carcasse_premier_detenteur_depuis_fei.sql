-- Recopie du premier détenteur de la fiche sur les carcasses qui ne l'ont pas.
--
-- Avant : `createNewCarcasse` créait toujours la carcasse avec premier_detenteur_* à NULL, alors
--         que le premier détenteur est choisi sur la fiche avant les carcasses. C'est la case de
--         validation de l'examen (updateFei → mapFeiFieldsToCarcasse) qui les recopiait ensuite.
--         Une carcasse ajoutée après cette validation n'était donc jamais rattrapée.
-- Effet : la carte de la fiche affiche « À renseigner » au lieu du premier détenteur (le nom est lu
--         sur une carcasse), et ces carcasses manquent dans les filtres / exports par premier
--         détenteur.
--
-- On ne touche que les carcasses dont le premier détenteur est entièrement vide : une carcasse qui
-- porte un autre premier détenteur que sa fiche relève d'un autre cas, à examiner à part.
--
-- `updated_at` est remis à now() pour que la synchro delta redescende la correction dans
-- l'IndexedDB des clients. `version` est incrémentée pour que la copie locale périmée d'un client
-- ne puisse pas écraser la correction. Le FORCE_FULL_RELOAD_AFTER est avancé dans la même PR.
--
-- À exécuter UNE FOIS, manuellement, sur la base (preprod puis prod), juste avant le merge.
--
-- Compte avant exécution (attendu en prod au 2026-10-19 : 9 fiches, 18 carcasses) :
--   SELECT count(DISTINCT c.fei_numero) AS nb_fiches, count(*) AS nb_carcasses
--   FROM "Carcasse" c JOIN "Fei" f ON f.numero = c.fei_numero
--   WHERE c.deleted_at IS NULL AND f.deleted_at IS NULL
--     AND (f.premier_detenteur_user_id IS NOT NULL OR f.premier_detenteur_entity_id IS NOT NULL)
--     AND c.premier_detenteur_user_id IS NULL
--     AND c.premier_detenteur_entity_id IS NULL
--     AND c.premier_detenteur_name_cache IS NULL;

BEGIN;

UPDATE "Carcasse" c
SET premier_detenteur_offline = f.premier_detenteur_offline,
    premier_detenteur_user_id = f.premier_detenteur_user_id,
    premier_detenteur_entity_id = f.premier_detenteur_entity_id,
    premier_detenteur_name_cache = f.premier_detenteur_name_cache,
    version = COALESCE(c.version, 0) + 1,
    version_user_id = NULL,
    updated_at = now()
FROM "Fei" f
WHERE f.numero = c.fei_numero
  AND c.deleted_at IS NULL
  AND f.deleted_at IS NULL
  AND (f.premier_detenteur_user_id IS NOT NULL OR f.premier_detenteur_entity_id IS NOT NULL)
  AND c.premier_detenteur_user_id IS NULL
  AND c.premier_detenteur_entity_id IS NULL
  AND c.premier_detenteur_name_cache IS NULL;

COMMIT;
