-- Question      : Fréquence des actions métier par semaine et par rôle
-- Dashboard      : Usage & métier
-- Viz conseillée : Ligne ou barres empilées. X = semaine, Y = nb_actions, série = action (ou rôle).
-- Regroupement   : par semaine × rôle × action (Log.action). Filtrable par rôle via {{role}}.
--
-- Source : table Log (journal d'usage métier). ~35 valeurs d'action possibles
--   (examinateur-create-fei, carcasse-accept, current-owner-confirm-*, svi-ipm2-edit, ...).
--   On écarte les actions techniques génériques 'create'/'update'/'delete'.
-- Filtres Metabase : {{from}} / {{to}} sur Log.created_at ; {{role}} optionnel (ex: 'SVI').

SELECT
  date_trunc('week', l.created_at)::date AS semaine,
  COALESCE(l.user_role, 'INCONNU') AS role,
  l.action AS action,
  COUNT(*) AS nb_actions
FROM "Log" l
LEFT JOIN "User" u ON u.id = l.user_id
WHERE l.action IS NOT NULL
  AND l.action NOT IN ('create', 'update', 'delete')
  AND COALESCE(u."isZacharieAdmin", false) = false
  AND COALESCE(u.email, '') NOT LIKE '%@example.org'
  [[ AND l.created_at >= {{from}} ]]
  [[ AND l.created_at <= {{to}} ]]
  [[ AND l.user_role = {{role}} ]]
GROUP BY 1, 2, 3
ORDER BY 1, 4 DESC;
