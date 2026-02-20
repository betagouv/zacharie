-- fei_debug: A debug-friendly view of the Fei table
-- Reorders columns into logical groups, adds computed columns, and JOINs readable names.
-- Usage: SELECT * FROM fei_debug ORDER BY updated_at DESC LIMIT 20;

CREATE OR REPLACE VIEW fei_debug AS
SELECT
  -- ── Identity ──
  f.numero,
  f.id,
  f.creation_context,
  f.created_by_user_id,

  -- ── Computed status ──
  (f.svi_assigned_at IS NOT NULL OR f.intermediaire_closed_at IS NOT NULL) AS is_done,
  CASE
    WHEN f.automatic_closed_at IS NOT NULL OR f.svi_closed_at IS NOT NULL OR f.intermediaire_closed_at IS NOT NULL THEN 'Clôturée'
    WHEN f.svi_assigned_at IS NOT NULL THEN 'Inspection SVI'
    WHEN f.fei_current_owner_role = 'EXAMINATEUR_INITIAL' THEN 'Examen initial'
    WHEN f.fei_current_owner_role = 'PREMIER_DETENTEUR' AND f.fei_next_owner_role IS NULL THEN 'Validation premier détenteur'
    WHEN f.fei_current_owner_role = 'PREMIER_DETENTEUR' AND f.fei_next_owner_role IS NOT NULL THEN 'Envoyée, pas traitée'
    ELSE 'En cours (intermédiaire/ETG)'
  END AS step_label,
  (SELECT COUNT(*) FROM "Carcasse" c WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL) AS nb_carcasses,
  (SELECT COUNT(DISTINCT ci.intermediaire_id) FROM "CarcasseIntermediaire" ci WHERE ci.fei_numero = f.numero AND ci.deleted_at IS NULL) AS nb_intermediaires,

  -- ── Closure flags ──
  f.svi_assigned_at,
  f.svi_closed_at,
  f.intermediaire_closed_at,
  f.automatic_closed_at,
  f.deleted_at,

  -- ── Current owner ──
  f.fei_current_owner_role,
  f.fei_current_owner_user_id,
  CONCAT(cur_u.prenom, ' ', cur_u.nom_de_famille) AS current_owner_user_name,
  f.fei_current_owner_entity_id,
  cur_e.nom_d_usage AS current_owner_entity_name,

  -- ── Next owner ──
  f.fei_next_owner_role,
  f.fei_next_owner_user_id,
  CONCAT(next_u.prenom, ' ', next_u.nom_de_famille) AS next_owner_user_name,
  f.fei_next_owner_entity_id,
  next_e.nom_d_usage AS next_owner_entity_name,

  -- ── Previous owner ──
  f.fei_prev_owner_role,
  f.fei_prev_owner_user_id,
  f.fei_prev_owner_entity_id,

  -- ── Sous-traite ──
  f.fei_next_owner_wants_to_sous_traite,
  f.fei_next_owner_sous_traite_at,
  f.fei_next_owner_sous_traite_by_user_id,
  f.fei_next_owner_sous_traite_by_entity_id,

  -- ── Examinateur initial ──
  f.examinateur_initial_user_id,
  CONCAT(exam.prenom, ' ', exam.nom_de_famille) AS examinateur_name,
  f.examinateur_initial_offline,
  f.examinateur_initial_approbation_mise_sur_le_marche,
  f.examinateur_initial_date_approbation_mise_sur_le_marche,

  -- ── Premier détenteur ──
  f.premier_detenteur_user_id,
  f.premier_detenteur_entity_id,
  f.premier_detenteur_name_cache,
  f.premier_detenteur_depot_type,
  f.premier_detenteur_depot_entity_id,
  f.premier_detenteur_depot_entity_name_cache,
  f.premier_detenteur_depot_ccg_at,
  f.premier_detenteur_transport_type,
  f.premier_detenteur_transport_date,
  f.premier_detenteur_prochain_detenteur_role_cache,
  f.premier_detenteur_prochain_detenteur_id_cache,
  f.premier_detenteur_offline,

  -- ── Intermediaire closure ──
  f.intermediaire_closed_by_user_id,
  f.intermediaire_closed_by_entity_id,
  f.latest_intermediaire_user_id,
  f.latest_intermediaire_entity_id,
  f.latest_intermediaire_name_cache,

  -- ── SVI ──
  f.svi_entity_id,
  svi_e.nom_d_usage AS svi_entity_name,
  f.svi_user_id,
  CONCAT(svi_u.prenom, ' ', svi_u.nom_de_famille) AS svi_user_name,
  f.svi_closed_by_user_id,

  -- ── Metadata ──
  f.date_mise_a_mort,
  f.commune_mise_a_mort,
  f.heure_mise_a_mort_premiere_carcasse,
  f.heure_evisceration_derniere_carcasse,
  f.resume_nombre_de_carcasses,

  -- ── Timestamps ──
  f.created_at,
  f.updated_at

FROM "Fei" f
LEFT JOIN "User" exam   ON exam.id   = f.examinateur_initial_user_id
LEFT JOIN "User" cur_u  ON cur_u.id  = f.fei_current_owner_user_id
LEFT JOIN "Entity" cur_e ON cur_e.id = f.fei_current_owner_entity_id
LEFT JOIN "User" next_u ON next_u.id = f.fei_next_owner_user_id
LEFT JOIN "Entity" next_e ON next_e.id = f.fei_next_owner_entity_id
LEFT JOIN "Entity" svi_e ON svi_e.id = f.svi_entity_id
LEFT JOIN "User" svi_u  ON svi_u.id  = f.svi_user_id;
