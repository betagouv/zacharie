-- Question      : Issues SVI — répartition des carcasses par statut et motif de saisie
-- Dashboard      : Usage & métier
-- Viz conseillée : Barres horizontales (X = statut_ou_motif, Y = total_animaux) ou table.
-- Regroupement   : par svi_carcasse_status, avec éclatement par motif (svi_ipm2_lesions_ou_motifs)
--                  pour les saisies.
--
-- Équivalent DATE-FILTRABLE de la vue matérialisée `carcasse_svi_stats`
--   (materialized-views/carcasses-svi-stats.sql). On reproduit sa logique pour pouvoir
--   filtrer sur la période ; sans filtre de date, on peut aussi faire directement :
--   SELECT * FROM carcasse_svi_stats ORDER BY status_or_motif;
--
-- Pour les saisies (SAISIE_TOTALE / SAISIE_PARTIELLE / TRAITEMENT_ASSAINISSANT) on affiche
--   le(s) motif(s) IPM2 ; pour les autres statuts décisionnels on affiche le statut.
-- Filtres Metabase : {{from}} / {{to}} sur Carcasse.svi_carcasse_status_set_at (date de décision).

SELECT
  CASE
    WHEN c.svi_carcasse_status IN ('SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT') THEN
      CASE
        WHEN c.svi_ipm2_lesions_ou_motifs IS NULL OR c.svi_ipm2_lesions_ou_motifs = '{}'
          THEN 'Aucun motif de saisie'
        ELSE array_to_string(c.svi_ipm2_lesions_ou_motifs::text[], ', ')
      END
    ELSE c.svi_carcasse_status::text
  END AS statut_ou_motif,
  SUM(
    CASE
      WHEN c.svi_carcasse_status IN ('SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT')
        THEN COALESCE(c.svi_ipm2_nombre_animaux, c.nombre_d_animaux, 1)
      ELSE COALESCE(c.nombre_d_animaux, 1)
    END
  ) AS total_animaux,
  COUNT(*) AS nb_carcasses
FROM "Carcasse" c
JOIN "Fei" f ON c.fei_numero = f.numero
WHERE c.deleted_at IS NULL
  AND c.svi_assigned_at IS NOT NULL
  AND f.created_by_user_id NOT LIKE '%GLOP%'
  -- on garde uniquement les statuts "à enjeu" (consigne/saisie/manquante/...), comme la vue
  AND c.svi_carcasse_status NOT IN
    ('MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'SANS_DECISION', 'CONSIGNE', 'MANQUANTE_SVI')
  [[ AND c.svi_carcasse_status_set_at >= {{from}} ]]
  [[ AND c.svi_carcasse_status_set_at <= {{to}} ]]
GROUP BY statut_ou_motif
ORDER BY total_animaux DESC;
