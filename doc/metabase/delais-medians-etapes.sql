-- Question      : Délais médians entre étapes successives (en heures)
-- Dashboard      : Tunnel FEI
-- Viz conseillée : Barres horizontales (X = transition, Y = delai_median_heures) ou table.
-- Regroupement   : par transition d'étape (1 ligne par couple d'étapes), médiane = percentile_cont(0.5).
--
-- Timestamps RÉELS utilisés (vérifiés dans schema.prisma) :
--   création                 = Fei.created_at
--   approbation examinateur  = Fei.examinateur_initial_date_approbation_mise_sur_le_marche
--   transmission au 1er dét. = MIN(Log.created_at) action 'current-owner-confirm-premier-detenteur'
--                              (DÉRIVÉ DU LOG : aucun timestamp dédié n'existe sur Fei/Carcasse)
--   réception ETG            = MIN(CarcasseIntermediaire.prise_en_charge_at) rôle ETG
--   assignation SVI          = MIN(Carcasse.svi_assigned_at)
--   inspection (IPM1)        = MIN(Carcasse.svi_ipm1_signed_at)
--   clôture SVI              = MAX(COALESCE(Carcasse.svi_closed_at, Carcasse.svi_automatic_closed_at))
--
-- Les délais négatifs ou nuls (incohérences de saisie) sont écartés via WHERE delta > 0.
-- Filtres Metabase : {{from}} / {{to}} sur Fei.created_at (cohorte de fiches par date de création).

WITH fei_ts AS (
  SELECT
    f.numero,
    f.created_at AS t_creation,
    f.examinateur_initial_date_approbation_mise_sur_le_marche AS t_exam_appro,
    (SELECT MIN(l.created_at) FROM "Log" l
       WHERE l.fei_numero = f.numero
         AND l.action = 'current-owner-confirm-premier-detenteur') AS t_premier_detenteur,
    (SELECT MIN(ci.prise_en_charge_at) FROM "CarcasseIntermediaire" ci
       WHERE ci.fei_numero = f.numero AND ci.deleted_at IS NULL
         AND ci.intermediaire_role = 'ETG') AS t_reception_etg,
    (SELECT MIN(c.svi_assigned_at) FROM "Carcasse" c
       WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL) AS t_svi_assigned,
    (SELECT MIN(c.svi_ipm1_signed_at) FROM "Carcasse" c
       WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL) AS t_svi_ipm1,
    (SELECT MAX(COALESCE(c.svi_closed_at, c.svi_automatic_closed_at)) FROM "Carcasse" c
       WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL) AS t_svi_closed
  FROM "Fei" f
  WHERE f.deleted_at IS NULL
    AND f.created_by_user_id NOT LIKE '%GLOP%'
    [[ AND f.created_at >= {{from}} ]]
    [[ AND f.created_at <= {{to}} ]]
),
deltas AS (
  SELECT
    1 AS ordre, 'Création → Approbation examinateur' AS transition,
    EXTRACT(EPOCH FROM (t_exam_appro - t_creation)) / 3600.0 AS heures FROM fei_ts
  UNION ALL
  SELECT 2, 'Approbation → Transmission 1er détenteur',
    EXTRACT(EPOCH FROM (t_premier_detenteur - t_exam_appro)) / 3600.0 FROM fei_ts
  UNION ALL
  SELECT 3, 'Transmission 1er détenteur → Réception ETG',
    EXTRACT(EPOCH FROM (t_reception_etg - t_premier_detenteur)) / 3600.0 FROM fei_ts
  UNION ALL
  SELECT 4, 'Réception ETG → Assignation SVI',
    EXTRACT(EPOCH FROM (t_svi_assigned - t_reception_etg)) / 3600.0 FROM fei_ts
  UNION ALL
  SELECT 5, 'Assignation SVI → Inspection (IPM1)',
    EXTRACT(EPOCH FROM (t_svi_ipm1 - t_svi_assigned)) / 3600.0 FROM fei_ts
  UNION ALL
  SELECT 6, 'Assignation SVI → Clôture SVI',
    EXTRACT(EPOCH FROM (t_svi_closed - t_svi_assigned)) / 3600.0 FROM fei_ts
)
SELECT
  transition,
  ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY heures)::numeric, 1) AS delai_median_heures,
  COUNT(*) AS nb_fei_mesurees
FROM deltas
WHERE heures IS NOT NULL AND heures > 0
GROUP BY ordre, transition
ORDER BY ordre;
