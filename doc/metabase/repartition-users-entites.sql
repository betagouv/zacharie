-- Question      : Répartition des utilisateurs et entités par rôle/type et département
-- Dashboard      : Activation & rétention
-- Viz conseillée : Table (categorie / type / departement / nb) ou barres empilées par département.
-- Regroupement   : par catégorie (Utilisateur|Entité) × type (rôle ou type d'entité) × département.
--
-- Département = 2 premiers caractères du code postal (User.code_postal / Entity.code_postal).
--   Voir README pour la limite Corse/DOM (codes à 3 chiffres).
-- On compte ici les comptes ENREGISTRÉS (pas seulement ceux apparaissant sur une fiche),
--   c'est pourquoi on requête directement User/Entity plutôt que la vue department_statistics
--   (qui, elle, est dérivée des FEI). Voir README.
--
-- Filtres Metabase : {{departement}} optionnel. Pas de filtre de date par défaut (photo de
--   l'existant) ; ajouter [[ AND created_at >= {{from}} ]] si on veut les inscriptions sur période.

-- Utilisateurs par rôle principal et département
SELECT
  'Utilisateur' AS categorie,
  COALESCE(u.role::text, u.roles[1]::text, 'INCONNU') AS type,
  COALESCE(NULLIF(SUBSTRING(u.code_postal FROM 1 FOR 2), ''), '??') AS departement,
  COUNT(*) AS nb
FROM "User" u
WHERE u.deleted_at IS NULL
  AND u."isZacharieAdmin" = false
  AND COALESCE(u.email, '') NOT LIKE '%@example.org'
  [[ AND COALESCE(NULLIF(SUBSTRING(u.code_postal FROM 1 FOR 2), ''), '??') = {{departement}} ]]
GROUP BY 2, 3

UNION ALL

-- Entités par type et département
SELECT
  'Entité' AS categorie,
  e.type::text AS type,
  COALESCE(NULLIF(SUBSTRING(e.code_postal FROM 1 FOR 2), ''), '??') AS departement,
  COUNT(*) AS nb
FROM "Entity" e
WHERE e.deleted_at IS NULL
  AND e.for_testing = false
  [[ AND COALESCE(NULLIF(SUBSTRING(e.code_postal FROM 1 FOR 2), ''), '??') = {{departement}} ]]
GROUP BY 2, 3

ORDER BY categorie, type, departement;
