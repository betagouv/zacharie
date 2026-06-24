-- Question      : FEI créées par semaine
-- Dashboard      : Tunnel FEI
-- Viz conseillée : Ligne (série temporelle). X = semaine, Y = nb_fei, série = rôle créateur.
-- Regroupement   : par semaine (date_trunc 'week') + rôle du créateur. Filtrable par département.
--
-- Le "rôle créateur" est dérivé du rôle principal de l'utilisateur créateur (User.role,
--   avec repli sur le 1er élément de User.roles[] tant que la migration role/roles n'est pas finie).
-- Département = 2 premiers caractères de Fei.commune_mise_a_mort (code INSEE/postal).
--
-- Filtres Metabase : {{from}} / {{to}} sur Fei.created_at ; {{departement}} optionnel.

SELECT
  date_trunc('week', f.created_at)::date AS semaine,
  COALESCE(u.role::text, u.roles[1]::text, 'INCONNU') AS role_createur,
  COUNT(*) AS nb_fei
FROM "Fei" f
JOIN "User" u ON u.id = f.created_by_user_id
WHERE f.deleted_at IS NULL
  AND f.created_by_user_id NOT LIKE '%GLOP%'  -- exclure les fiches de test
  [[ AND f.created_at >= {{from}} ]]
  [[ AND f.created_at <= {{to}} ]]
  [[ AND SUBSTRING(f.commune_mise_a_mort FROM 1 FOR 2) = {{departement}} ]]
GROUP BY 1, 2
ORDER BY 1, 2;
