DROP MATERIALIZED VIEW IF EXISTS fei_stats;

CREATE MATERIALIZED VIEW fei_stats AS
WITH base_stats AS (
  SELECT 
    f.numero as fei_numero,
    COUNT(c.zacharie_carcasse_id) as total_carcasses,
    COALESCE(SUM(CASE WHEN ci.refus IS NOT NULL THEN 1 ELSE 0 END), 0) as destinataires_number_of_carcasses_refusees_total,
    COALESCE(SUM(CASE WHEN ci.manquante = true THEN 1 ELSE 0 END), 0) as destinataires_number_of_carcasses_manquantes_total,
    COALESCE(f.svi_carcasses_saisies, 0) as svi_carcasses_saisies,
    CASE WHEN f.svi_signed_at IS NOT NULL 
      OR (f.svi_assigned_at IS NOT NULL AND f.svi_assigned_at < NOW() - INTERVAL '10 days')
      THEN true ELSE false END as fei_closed,
    CASE WHEN f.examinateur_initial_date_approbation_mise_sur_le_marche IS NOT NULL 
      AND NOT EXISTS (
        SELECT 1 FROM "User" u 
        WHERE u.id = f.examinateur_initial_user_id 
        AND 'ADMIN' = ANY(u.roles)
      ) THEN true ELSE false END as approved_by_examiner,
    CASE WHEN f.premier_detenteur_user_id IS NOT NULL 
      OR f.premier_detenteur_entity_id IS NOT NULL THEN true ELSE false END as has_premier_detenteur,
    CASE WHEN EXISTS (
      SELECT 1 FROM "FeiIntermediaire" fi 
      WHERE fi.fei_numero = f.numero 
      AND fi.deleted_at IS NULL
    ) THEN true ELSE false END as has_intermediaire,
    CASE WHEN EXISTS (
      SELECT 1 FROM "FeiIntermediaire" fi 
      WHERE fi.fei_numero = f.numero 
      AND fi.check_finished_at IS NOT NULL
      AND fi.deleted_at IS NULL
    ) THEN true ELSE false END as has_intermediaire_check,
    CASE WHEN f.svi_assigned_at IS NOT NULL THEN true ELSE false END as svi_assigned,
    CASE WHEN f.svi_signed_at IS NOT NULL THEN true ELSE false END as svi_signed,
    f.created_at,
    f.updated_at
  FROM "Fei" f
  LEFT JOIN "Carcasse" c ON c.fei_numero = f.numero
  LEFT JOIN "CarcasseIntermediaire" ci ON ci.zacharie_carcasse_id = c.zacharie_carcasse_id
  WHERE f.deleted_at IS NULL
  GROUP BY f.numero, f.svi_signed_at, f.svi_assigned_at, f.examinateur_initial_user_id,
    f.examinateur_initial_date_approbation_mise_sur_le_marche, f.premier_detenteur_user_id,
    f.premier_detenteur_entity_id, f.created_at, f.updated_at, f.svi_carcasses_saisies
)
SELECT 
  gen_random_uuid() as id,
  *
FROM base_stats
WITH DATA;

CREATE UNIQUE INDEX fei_stats_fei_numero_idx ON fei_stats(fei_numero);