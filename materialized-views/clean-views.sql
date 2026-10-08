-- Vues « données propres » : sources à utiliser dans Metabase à la place des tables brutes.
-- Elles excluent :
-- - les lignes supprimées (deleted_at), dont les fiches et carcasses supprimées depuis l'admin ;
-- - les comptes et entités de test ou de démo (exclude_from_stats, coché depuis l'admin), et toute
--   fiche où l'un d'eux apparaît.
-- Vues simples (pas matérialisées) : toujours à jour, sans refresh.
-- Dans Metabase, masquer les tables brutes "Fei", "Carcasse", "CarcasseIntermediaire", "User" et
-- "Entity" (Admin → Modèle de données → visibilité « Masquée ») pour que toute question parte de ces vues.
--
-- `SELECT *` fige la liste des colonnes à la création de la vue : rejouer ce fichier après une
-- migration qui ajoute des colonnes à ces tables.

-- Les vues dépendent les unes des autres : on les supprime dans l'ordre inverse de création.
DROP VIEW IF EXISTS carcasse_intermediaire_view;
DROP VIEW IF EXISTS carcasse_view;
DROP VIEW IF EXISTS fei_view;
DROP VIEW IF EXISTS fei_exclue_des_stats;
DROP VIEW IF EXISTS user_view;
DROP VIEW IF EXISTS entity_view;

CREATE VIEW user_view AS
SELECT u.*
FROM "User" u
WHERE u.deleted_at IS NULL
  AND u."isZacharieAdmin" = FALSE
  AND u.exclude_from_stats = FALSE;

CREATE VIEW entity_view AS
SELECT e.*
FROM "Entity" e
WHERE e.deleted_at IS NULL
  AND e.exclude_from_stats = FALSE;

-- Fiches où apparaît un compte ou une entité exclus des stats : sur la fiche (créateur, examinateur,
-- premier détenteur), sur l'une de ses carcasses (détenteurs successifs, dépôt, SVI) ou sur l'une de
-- ses lignes d'intermédiaire. version_user_id n'est pas un acteur (auteur technique de la dernière écriture).
CREATE VIEW fei_exclue_des_stats AS
SELECT f.numero AS fei_numero
FROM "Fei" f
WHERE EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.exclude_from_stats
      AND u.id IN (f.created_by_user_id, f.examinateur_initial_user_id, f.premier_detenteur_user_id)
  )
  OR EXISTS (
    SELECT 1 FROM "Entity" e
    WHERE e.exclude_from_stats
      AND e.id = f.premier_detenteur_entity_id
  )
UNION
SELECT c.fei_numero
FROM "Carcasse" c
WHERE EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.exclude_from_stats
      AND u.id IN (
        c.current_owner_user_id, c.next_owner_user_id, c.prev_owner_user_id,
        c.latest_intermediaire_user_id, c.svi_user_id
      )
  )
  OR EXISTS (
    SELECT 1 FROM "Entity" e
    WHERE e.exclude_from_stats
      AND e.id IN (
        c.current_owner_entity_id, c.next_owner_entity_id, c.prev_owner_entity_id,
        c.latest_intermediaire_entity_id, c.premier_detenteur_depot_entity_id, c.svi_entity_id
      )
  )
UNION
SELECT ci.fei_numero
FROM "CarcasseIntermediaire" ci
WHERE EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.exclude_from_stats
      AND u.id = ci.intermediaire_user_id
  )
  OR EXISTS (
    SELECT 1 FROM "Entity" e
    WHERE e.exclude_from_stats
      AND e.id IN (ci.intermediaire_entity_id, ci.intermediaire_depot_entity_id)
  );

CREATE VIEW fei_view AS
SELECT f.*
FROM "Fei" f
WHERE f.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM fei_exclue_des_stats x WHERE x.fei_numero = f.numero);

-- Une carcasse hérite de l'exclusion de sa fiche (supprimée ou de test), au cas où elle n'aurait pas
-- été supprimée avec elle.
CREATE VIEW carcasse_view AS
SELECT c.*
FROM "Carcasse" c
JOIN fei_view f ON f.numero = c.fei_numero
WHERE c.deleted_at IS NULL;

CREATE VIEW carcasse_intermediaire_view AS
SELECT ci.*
FROM "CarcasseIntermediaire" ci
JOIN carcasse_view c ON c.zacharie_carcasse_id = ci.zacharie_carcasse_id
WHERE ci.deleted_at IS NULL;
