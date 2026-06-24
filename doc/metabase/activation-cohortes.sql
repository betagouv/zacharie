-- Question      : Activation par cohorte d'inscription
-- Dashboard      : Activation & rétention
-- Viz conseillée : Barres groupées par semaine (3 séries) OU table. Pour le funnel d'activation
--                  global, voir le bloc commenté en bas (1 ligne par étape).
-- Regroupement   : par semaine d'activation du compte (User.activated_at).
--
-- Funnel d'activation : Inscrit (activé) → a créé une 1ère FEI → a une 1ère FEI traitée.
--   - "inscrit"            = User.activated_at NON NULL (compte activé cette semaine-là)
--   - "a créé une 1ère FEI"= EXISTS une Fei dont created_by_user_id = user.id
--   - "1ère FEI traitée"   = User.at_least_one_fei_treated NON NULL (champ entretenu côté backend)
--
-- Exclut les comptes de test/admin. Filtres Metabase : {{from}} / {{to}} sur User.activated_at.

WITH cohorte AS (
  SELECT
    u.id,
    date_trunc('week', u.activated_at)::date AS semaine_inscription,
    EXISTS (SELECT 1 FROM "Fei" f WHERE f.created_by_user_id = u.id AND f.deleted_at IS NULL) AS a_cree_fei,
    (u.at_least_one_fei_treated IS NOT NULL) AS a_fei_traitee
  FROM "User" u
  WHERE u.activated_at IS NOT NULL
    AND u.deleted_at IS NULL
    AND u."isZacharieAdmin" = false
    AND COALESCE(u.email, '') NOT LIKE '%@example.org'  -- exclure les comptes de test
    [[ AND u.activated_at >= {{from}} ]]
    [[ AND u.activated_at <= {{to}} ]]
)
SELECT
  semaine_inscription,
  COUNT(*)                              AS nb_inscrits,
  COUNT(*) FILTER (WHERE a_cree_fei)    AS nb_avec_1ere_fei,
  COUNT(*) FILTER (WHERE a_fei_traitee) AS nb_avec_fei_traitee
FROM cohorte
GROUP BY semaine_inscription
ORDER BY semaine_inscription;

-- ----------------------------------------------------------------------------
-- Variante "funnel d'activation global" (1 ligne par étape, sans découpe hebdo).
-- Décommenter et utiliser à la place du SELECT ci-dessus pour une viz Funnel.
-- ----------------------------------------------------------------------------
-- WITH cohorte AS ( ... même CTE que ci-dessus ... )
-- SELECT 1 AS ordre, 'Inscrits (activés)'  AS etape, COUNT(*)                              AS nb FROM cohorte
-- UNION ALL
-- SELECT 2, 'A créé une 1ère FEI',          COUNT(*) FILTER (WHERE a_cree_fei)    FROM cohorte
-- UNION ALL
-- SELECT 3, 'A une 1ère FEI traitée',       COUNT(*) FILTER (WHERE a_fei_traitee) FROM cohorte
-- ORDER BY ordre;
