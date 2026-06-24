-- Question      : Taux de refus / carcasses manquantes chez les intermédiaires
-- Dashboard      : Usage & métier
-- Viz conseillée : Barres (statut / nb_carcasses) + Big Number pour le taux global. Ou table.
-- Regroupement   : par statut de la dernière décision intermédiaire (manquante / motif de refus / OK).
--
-- Équivalent DATE-FILTRABLE de la vue matérialisée `carcasse_intermediaire_refus_stats`
--   (materialized-views/carcasses-intermediaires-stats.sql). On lit les champs de décision du
--   DERNIER intermédiaire stockés sur la Carcasse (1 ligne par carcasse) :
--     - intermediaire_carcasse_manquante (Boolean)
--     - intermediaire_carcasse_refus_motif (String)
--     - latest_intermediaire_signed_at (DateTime) → sert au filtre de date.
--   Sans filtre de date, on peut aussi faire : SELECT * FROM carcasse_intermediaire_refus_stats;
--
-- La colonne "part_pct" donne le taux (% des carcasses passées par un intermédiaire).
-- Filtres Metabase : {{from}} / {{to}} sur Carcasse.latest_intermediaire_signed_at.

WITH base AS (
  SELECT
    c.zacharie_carcasse_id,
    CASE
      WHEN c.intermediaire_carcasse_manquante = TRUE THEN 'Carcasse manquante'
      WHEN c.intermediaire_carcasse_refus_motif IS NOT NULL AND c.intermediaire_carcasse_refus_motif != ''
        THEN c.intermediaire_carcasse_refus_motif
      ELSE 'Aucun problème'
    END AS statut
  FROM "Carcasse" c
  JOIN "Fei" f ON c.fei_numero = f.numero
  WHERE c.deleted_at IS NULL
    AND c.latest_intermediaire_signed_at IS NOT NULL  -- a bien atteint un intermédiaire
    AND f.created_by_user_id NOT LIKE '%GLOP%'
    [[ AND c.latest_intermediaire_signed_at >= {{from}} ]]
    [[ AND c.latest_intermediaire_signed_at <= {{to}} ]]
)
SELECT
  statut,
  COUNT(*) AS nb_carcasses,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS part_pct
FROM base
GROUP BY statut
ORDER BY nb_carcasses DESC;
