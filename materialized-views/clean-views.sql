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

-- Metabase ne sait pas filtrer une colonne tableau : roles_texte expose les rôles en texte
-- (un seul rôle par utilisateur, séparés par une virgule sinon).
CREATE VIEW user_view AS
SELECT u.*, array_to_string(u.roles, ', ') AS roles_texte
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
-- premier détenteur), sur l'une de ses carcasses (détenteurs successifs, SVI) ou sur l'une de ses
-- lignes d'intermédiaire. version_user_id n'est pas un acteur (auteur technique de la dernière écriture).
-- On part des quelques comptes et entités exclus, une branche par colonne : chaque branche lit l'index
-- de la colonne au lieu de parcourir toute la table. Seules des colonnes indexées sont lues, sauf
-- Fei.premier_detenteur_entity_id (table petite).
CREATE VIEW fei_exclue_des_stats AS
SELECT numero AS fei_numero FROM "Fei"
WHERE created_by_user_id IN (SELECT id FROM "User" WHERE exclude_from_stats)
UNION
SELECT numero FROM "Fei"
WHERE examinateur_initial_user_id IN (SELECT id FROM "User" WHERE exclude_from_stats)
UNION
SELECT numero FROM "Fei"
WHERE premier_detenteur_user_id IN (SELECT id FROM "User" WHERE exclude_from_stats)
UNION
SELECT numero FROM "Fei"
WHERE premier_detenteur_entity_id IN (SELECT id FROM "Entity" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "Carcasse"
WHERE current_owner_user_id IN (SELECT id FROM "User" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "Carcasse"
WHERE next_owner_user_id IN (SELECT id FROM "User" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "Carcasse"
WHERE prev_owner_user_id IN (SELECT id FROM "User" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "Carcasse"
WHERE current_owner_entity_id IN (SELECT id FROM "Entity" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "Carcasse"
WHERE next_owner_entity_id IN (SELECT id FROM "Entity" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "Carcasse"
WHERE prev_owner_entity_id IN (SELECT id FROM "Entity" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "Carcasse"
WHERE svi_entity_id IN (SELECT id FROM "Entity" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "CarcasseIntermediaire"
WHERE intermediaire_user_id IN (SELECT id FROM "User" WHERE exclude_from_stats)
UNION
SELECT fei_numero FROM "CarcasseIntermediaire"
WHERE intermediaire_entity_id IN (SELECT id FROM "Entity" WHERE exclude_from_stats);

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
