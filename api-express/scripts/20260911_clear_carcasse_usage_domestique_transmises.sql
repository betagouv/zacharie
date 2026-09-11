-- Nettoyage de Carcasse.consommateur_final_usage_domestique sur les carcasses transmises.
--
-- Avant : `consommateur_final_usage_domestique` était un champ de FICHE. À chaque `updateFei`,
--         le front le recopiait sur TOUTES les carcasses de la fiche (mapFeiFieldsToCarcasse),
--         puis la synchro le persistait en base. Une carcasse partie chez un ETG portait donc
--         le drapeau alors qu'elle n'avait jamais été gardée pour un usage domestique.
-- Après : le drapeau est propre à chaque carcasse (le premier détenteur n'en garde qu'une partie),
--         et l'affichage le lit carcasse par carcasse. Sans ce nettoyage, ces carcasses
--         apparaissent « Usage domestique privé » au lieu de « Envoyée à <ETG> », et sont
--         regroupées sous « Usage domestique » dans l'onglet carcasses du chasseur.
--
-- Discriminant : une carcasse réellement gardée par le premier détenteur n'a pas de destinataire.
-- Dès qu'un destinataire a été choisi (premier_detenteur_prochain_detenteur_id_cache) ou que la
-- carcasse est partie plus loin (next_owner_entity_id, latest_intermediaire_entity_id), le drapeau
-- est un résidu de l'ancien modèle.
--
-- Les fiches entièrement en usage domestique (aucun destinataire) gardent leur drapeau : sous le
-- nouveau modèle, elles se lisent correctement comme « toutes les carcasses en usage domestique ».
-- Fei.consommateur_final_usage_domestique n'est pas touché : le champ fiche reste l'historique.
--
-- `updated_at` est remis à now() volontairement : `@updatedAt` est géré par Prisma, pas par la base,
-- et sans ce coup de pouce la synchro delta ne redescendrait jamais la correction dans l'IndexedDB
-- des clients, qui continueraient d'afficher « Usage domestique privé ».
--
-- À exécuter UNE FOIS, manuellement, sur la base (preprod puis prod), juste avant le merge.
--
-- Compte avant exécution :
--   SELECT count(*) FROM "Carcasse"
--   WHERE consommateur_final_usage_domestique IS NOT NULL
--     AND deleted_at IS NULL
--     AND (premier_detenteur_prochain_detenteur_id_cache IS NOT NULL
--          OR next_owner_entity_id IS NOT NULL
--          OR latest_intermediaire_entity_id IS NOT NULL);

BEGIN;

UPDATE "Carcasse"
SET consommateur_final_usage_domestique = NULL,
    updated_at = now()
WHERE consommateur_final_usage_domestique IS NOT NULL
  AND deleted_at IS NULL
  AND (
    premier_detenteur_prochain_detenteur_id_cache IS NOT NULL
    OR next_owner_entity_id IS NOT NULL
    OR latest_intermediaire_entity_id IS NOT NULL
  );

COMMIT;
