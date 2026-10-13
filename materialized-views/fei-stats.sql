DROP MATERIALIZED VIEW IF EXISTS fei_stats;

CREATE MATERIALIZED VIEW fei_stats AS
-- La clôture et l'inspection SVI sont portées par chaque carcasse : on les agrège par fiche.
-- Une carcasse est terminée selon la même règle que isCarcasseDone (api-express/src/utils/is-carcasse-done.ts),
-- en lisant le statut SVI enregistré, plus la règle d'auto-clôture à 10 jours après assignation au SVI.
WITH carcasse_stats AS (
  SELECT
    c.fei_numero,
    bool_and(COALESCE(
      c.svi_closed_at IS NOT NULL
      OR c.svi_automatic_closed_at IS NOT NULL
      OR c.intermediaire_closed_at IS NOT NULL
      OR c.intermediaire_carcasse_refus_intermediaire_id IS NOT NULL
      OR c.intermediaire_carcasse_manquante = true
      OR c.consommateur_final_usage_domestique IS NOT NULL
      OR c.svi_carcasse_status IN ('ACCEPTE', 'MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'MANQUANTE_SVI',
        'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'LEVEE_DE_CONSIGNE', 'TRAITEMENT_ASSAINISSANT')
      OR c.svi_assigned_at < NOW() - INTERVAL '10 days',
      false
    )) as all_carcasses_closed,
    bool_or(c.svi_assigned_at IS NOT NULL) as any_svi_assigned,
    -- la fiche est signée par le SVI quand toutes les carcasses qui lui ont été assignées sont clôturées manuellement
    bool_or(c.svi_closed_at IS NOT NULL)
      AND bool_and(c.svi_assigned_at IS NULL OR c.svi_closed_at IS NOT NULL) as all_svi_carcasses_signed
  FROM "Carcasse" c
  WHERE c.deleted_at IS NULL
  GROUP BY c.fei_numero
),
base_stats AS (
  SELECT
    f.numero as fei_numero,
    (SELECT COUNT(*) FROM "Carcasse" c WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL) as total_carcasses,
    COALESCE(SUM(CASE WHEN ci.refus IS NOT NULL THEN 1 ELSE 0 END), 0) as destinataires_number_of_carcasses_refusees_total,
    COALESCE(SUM(CASE WHEN ci.manquante = true THEN 1 ELSE 0 END), 0) as destinataires_number_of_carcasses_manquantes_total,
    COALESCE(cs.all_carcasses_closed, false) as fei_closed,
    CASE WHEN f.examinateur_initial_date_approbation_mise_sur_le_marche IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "User" u
        WHERE u.id = f.examinateur_initial_user_id
        AND 'ADMIN' = ANY(u.roles)
      ) THEN true ELSE false END as approved_by_examiner,
    CASE WHEN f.premier_detenteur_user_id IS NOT NULL
      OR f.premier_detenteur_entity_id IS NOT NULL THEN true ELSE false END as has_premier_detenteur,
    CASE WHEN EXISTS (
      SELECT 1 FROM "CarcasseIntermediaire" ci
      WHERE ci.fei_numero = f.numero
      AND ci.deleted_at IS NULL
    ) THEN true ELSE false END as has_intermediaire,
    CASE WHEN EXISTS (
      SELECT 1 FROM "CarcasseIntermediaire" ci
      WHERE ci.fei_numero = f.numero
      AND ci.prise_en_charge_at IS NOT NULL
      AND ci.deleted_at IS NULL
    ) THEN true ELSE false END as has_intermediaire_check,
    COALESCE(cs.any_svi_assigned, false) as svi_assigned,
    COALESCE(cs.all_svi_carcasses_signed, false) as svi_signed,
    f.created_at,
    f.updated_at
  FROM "Fei" f
  LEFT JOIN carcasse_stats cs ON cs.fei_numero = f.numero
  LEFT JOIN "Carcasse" c ON c.fei_numero = f.numero AND c.deleted_at IS NULL
  LEFT JOIN "CarcasseIntermediaire" ci ON ci.zacharie_carcasse_id = c.zacharie_carcasse_id
  WHERE f.deleted_at IS NULL
  GROUP BY f.numero, cs.all_carcasses_closed, cs.any_svi_assigned, cs.all_svi_carcasses_signed,
    f.examinateur_initial_user_id, f.examinateur_initial_date_approbation_mise_sur_le_marche,
    f.premier_detenteur_user_id, f.premier_detenteur_entity_id, f.created_at, f.updated_at
)
SELECT
  gen_random_uuid() as id,
  *
FROM base_stats
WITH DATA;

CREATE UNIQUE INDEX fei_stats_fei_numero_idx ON fei_stats(fei_numero);

--