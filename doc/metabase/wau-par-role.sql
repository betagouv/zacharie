-- Question      : Utilisateurs actifs hebdomadaires (WAU) par rôle
-- Dashboard      : Activation & rétention
-- Viz conseillée : Ligne. X = semaine, Y = nb_utilisateurs_actifs, série = rôle.
-- Regroupement   : par semaine ISO + rôle de l'utilisateur.
--
-- CHOIX DE LA SOURCE (justifié dans le README) :
--   On dérive l'activité de la table Log (Log.created_at par action métier), PAS de
--   User.last_seen_at. Raison : last_seen_at ne stocke QU'UNE date (le dernier passage),
--   donc il ne permet pas une série temporelle historique — seulement un instantané "actif
--   sur les 7 derniers jours". Le Log, lui, garde une ligne horodatée par action et donne
--   un vrai WAU historique. Un utilisateur est "actif" une semaine s'il a au moins 1 action.
--
-- Le rôle est pris depuis Log.user_role (renseigné au moment de l'action) ;
--   repli sur le rôle courant de l'utilisateur si absent.
-- Filtres Metabase : {{from}} / {{to}} sur Log.created_at.

SELECT
  date_trunc('week', l.created_at)::date AS semaine,
  COALESCE(l.user_role, u.role::text, u.roles[1]::text, 'INCONNU') AS role,
  COUNT(DISTINCT l.user_id) AS nb_utilisateurs_actifs
FROM "Log" l
LEFT JOIN "User" u ON u.id = l.user_id
WHERE l.user_id IS NOT NULL
  AND l.action NOT IN ('create', 'update', 'delete')  -- garder les actions métier, pas le bruit technique
  AND COALESCE(u."isZacharieAdmin", false) = false
  AND COALESCE(u.email, '') NOT LIKE '%@example.org'
  [[ AND l.created_at >= {{from}} ]]
  [[ AND l.created_at <= {{to}} ]]
GROUP BY 1, 2
ORDER BY 1, 2;

-- ----------------------------------------------------------------------------
-- Variante "instantané" basée sur User.last_seen_at (pas de série temporelle).
-- Compte les utilisateurs vus dans les 7 derniers jours, par rôle. À utiliser en Big Number
-- ou barres, jamais en courbe historique.
-- ----------------------------------------------------------------------------
-- SELECT COALESCE(u.role::text, u.roles[1]::text, 'INCONNU') AS role,
--        COUNT(*) AS nb_actifs_7j
-- FROM "User" u
-- WHERE u.last_seen_at >= NOW() - INTERVAL '7 days'
--   AND u."isZacharieAdmin" = false
--   AND COALESCE(u.email, '') NOT LIKE '%@example.org'
-- GROUP BY 1 ORDER BY 2 DESC;
