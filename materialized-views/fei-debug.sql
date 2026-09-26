-- fei_debug: A debug-friendly view of the Fei table
-- Reorders columns into logical groups, adds computed columns, and JOINs readable names.
-- Ownership, dépôt/transport, intermédiaire, SVI and closure live on each Carcasse: they are aggregated
-- per fiche (MIN/MAX for dates, distinct values joined by ', ' for ids, roles and names).
-- Usage: SELECT * FROM fei_debug ORDER BY updated_at DESC LIMIT 20;

DROP VIEW IF EXISTS fei_debug;

CREATE VIEW fei_debug AS
SELECT
  -- ── Identity ──
  f.numero,
  f.id,
  f.creation_context,
  f.created_by_user_id,

  -- ── Computed status ──
  COALESCE(agg.is_done, false) AS is_done,
  CASE
    WHEN agg.all_carcasses_closed THEN 'Clôturée'
    WHEN agg.any_svi_assigned THEN 'Inspection SVI'
    WHEN agg.any_owner_examinateur THEN 'Examen initial'
    WHEN agg.any_owner_premier_detenteur_without_next THEN 'Validation premier détenteur'
    WHEN agg.any_owner_premier_detenteur_with_next THEN 'Envoyée, pas traitée'
    ELSE 'En cours (intermédiaire/ETG)'
  END AS step_label,
  agg.nb_carcasses,
  (SELECT COUNT(DISTINCT ci.intermediaire_id) FROM "CarcasseIntermediaire" ci WHERE ci.fei_numero = f.numero AND ci.deleted_at IS NULL) AS nb_intermediaires,

  -- ── Closure flags ──
  agg.svi_assigned_at,
  agg.svi_closed_at,
  agg.intermediaire_closed_at,
  agg.automatic_closed_at,
  f.deleted_at,

  -- ── Current owner ──
  agg.fei_current_owner_role,
  agg.fei_current_owner_user_id,
  agg.current_owner_user_name,
  agg.fei_current_owner_entity_id,
  agg.current_owner_entity_name,

  -- ── Next owner ──
  agg.fei_next_owner_role,
  agg.fei_next_owner_user_id,
  agg.next_owner_user_name,
  agg.fei_next_owner_entity_id,
  agg.next_owner_entity_name,

  -- ── Previous owner ──
  agg.fei_prev_owner_role,
  agg.fei_prev_owner_user_id,
  agg.fei_prev_owner_entity_id,

  -- ── Sous-traite ──
  agg.fei_next_owner_wants_to_sous_traite,
  agg.fei_next_owner_sous_traite_at,
  agg.fei_next_owner_sous_traite_by_user_id,
  agg.fei_next_owner_sous_traite_by_entity_id,

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
  agg.premier_detenteur_depot_type,
  agg.premier_detenteur_depot_entity_id,
  agg.premier_detenteur_depot_entity_name_cache,
  agg.premier_detenteur_depot_ccg_at,
  agg.premier_detenteur_transport_type,
  agg.premier_detenteur_transport_date,
  agg.premier_detenteur_prochain_detenteur_role_cache,
  agg.premier_detenteur_prochain_detenteur_id_cache,
  f.premier_detenteur_offline,

  -- ── Intermediaire closure ──
  agg.intermediaire_closed_by_user_id,
  agg.intermediaire_closed_by_entity_id,
  agg.latest_intermediaire_user_id,
  agg.latest_intermediaire_entity_id,
  agg.latest_intermediaire_name_cache,

  -- ── SVI ──
  agg.svi_entity_id,
  agg.svi_entity_name,
  agg.svi_user_id,
  agg.svi_user_name,
  agg.svi_closed_by_user_id,

  -- ── Metadata ──
  f.date_mise_a_mort,
  f.commune_mise_a_mort,
  f.heure_mise_a_mort_premiere_carcasse,
  f.heure_evisceration_derniere_carcasse,

  -- ── Timestamps ──
  f.created_at,
  f.updated_at

FROM "Fei" f
LEFT JOIN "User" exam ON exam.id = f.examinateur_initial_user_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS nb_carcasses,
    -- même règle que isCarcasseDone (api-express/src/utils/is-carcasse-done.ts), sur le statut SVI enregistré
    bool_and(COALESCE(
      c.svi_closed_at IS NOT NULL
      OR c.svi_automatic_closed_at IS NOT NULL
      OR c.intermediaire_closed_at IS NOT NULL
      OR c.intermediaire_carcasse_refus_intermediaire_id IS NOT NULL
      OR c.intermediaire_carcasse_manquante = true
      OR c.consommateur_final_usage_domestique IS NOT NULL
      OR c.svi_carcasse_status IN ('ACCEPTE', 'MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'MANQUANTE_SVI',
        'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'LEVEE_DE_CONSIGNE', 'TRAITEMENT_ASSAINISSANT'),
      false
    )) AS all_carcasses_closed,
    bool_and(c.svi_assigned_at IS NOT NULL OR c.intermediaire_closed_at IS NOT NULL) AS is_done,
    bool_or(c.svi_assigned_at IS NOT NULL) AS any_svi_assigned,
    bool_or(c.current_owner_role = 'EXAMINATEUR_INITIAL') AS any_owner_examinateur,
    bool_or(c.current_owner_role = 'PREMIER_DETENTEUR' AND c.next_owner_role IS NULL) AS any_owner_premier_detenteur_without_next,
    bool_or(c.current_owner_role = 'PREMIER_DETENTEUR' AND c.next_owner_role IS NOT NULL) AS any_owner_premier_detenteur_with_next,

    MIN(c.svi_assigned_at) AS svi_assigned_at,
    MAX(c.svi_closed_at) AS svi_closed_at,
    MAX(c.intermediaire_closed_at) AS intermediaire_closed_at,
    MAX(c.svi_automatic_closed_at) AS automatic_closed_at,

    string_agg(DISTINCT c.current_owner_role::text, ', ') AS fei_current_owner_role,
    string_agg(DISTINCT c.current_owner_user_id, ', ') AS fei_current_owner_user_id,
    string_agg(DISTINCT NULLIF(CONCAT_WS(' ', cur_u.prenom, cur_u.nom_de_famille), ''), ', ') AS current_owner_user_name,
    string_agg(DISTINCT c.current_owner_entity_id, ', ') AS fei_current_owner_entity_id,
    string_agg(DISTINCT cur_e.nom_d_usage, ', ') AS current_owner_entity_name,

    string_agg(DISTINCT c.next_owner_role::text, ', ') AS fei_next_owner_role,
    string_agg(DISTINCT c.next_owner_user_id, ', ') AS fei_next_owner_user_id,
    string_agg(DISTINCT NULLIF(CONCAT_WS(' ', next_u.prenom, next_u.nom_de_famille), ''), ', ') AS next_owner_user_name,
    string_agg(DISTINCT c.next_owner_entity_id, ', ') AS fei_next_owner_entity_id,
    string_agg(DISTINCT next_e.nom_d_usage, ', ') AS next_owner_entity_name,

    string_agg(DISTINCT c.prev_owner_role::text, ', ') AS fei_prev_owner_role,
    string_agg(DISTINCT c.prev_owner_user_id, ', ') AS fei_prev_owner_user_id,
    string_agg(DISTINCT c.prev_owner_entity_id, ', ') AS fei_prev_owner_entity_id,

    bool_or(c.next_owner_wants_to_sous_traite) AS fei_next_owner_wants_to_sous_traite,
    MAX(c.next_owner_sous_traite_at) AS fei_next_owner_sous_traite_at,
    string_agg(DISTINCT c.next_owner_sous_traite_by_user_id, ', ') AS fei_next_owner_sous_traite_by_user_id,
    string_agg(DISTINCT c.next_owner_sous_traite_by_entity_id, ', ') AS fei_next_owner_sous_traite_by_entity_id,

    string_agg(DISTINCT c.premier_detenteur_depot_type::text, ', ') AS premier_detenteur_depot_type,
    string_agg(DISTINCT c.premier_detenteur_depot_entity_id, ', ') AS premier_detenteur_depot_entity_id,
    string_agg(DISTINCT c.premier_detenteur_depot_entity_name_cache, ', ') AS premier_detenteur_depot_entity_name_cache,
    MAX(c.premier_detenteur_depot_ccg_at) AS premier_detenteur_depot_ccg_at,
    string_agg(DISTINCT c.premier_detenteur_transport_type::text, ', ') AS premier_detenteur_transport_type,
    MAX(c.premier_detenteur_transport_date) AS premier_detenteur_transport_date,
    string_agg(DISTINCT c.premier_detenteur_prochain_detenteur_role_cache::text, ', ') AS premier_detenteur_prochain_detenteur_role_cache,
    string_agg(DISTINCT c.premier_detenteur_prochain_detenteur_id_cache, ', ') AS premier_detenteur_prochain_detenteur_id_cache,

    string_agg(DISTINCT c.intermediaire_closed_by_user_id, ', ') AS intermediaire_closed_by_user_id,
    string_agg(DISTINCT c.intermediaire_closed_by_entity_id, ', ') AS intermediaire_closed_by_entity_id,
    string_agg(DISTINCT c.latest_intermediaire_user_id, ', ') AS latest_intermediaire_user_id,
    string_agg(DISTINCT c.latest_intermediaire_entity_id, ', ') AS latest_intermediaire_entity_id,
    string_agg(DISTINCT c.latest_intermediaire_name_cache, ', ') AS latest_intermediaire_name_cache,

    string_agg(DISTINCT c.svi_entity_id, ', ') AS svi_entity_id,
    string_agg(DISTINCT svi_e.nom_d_usage, ', ') AS svi_entity_name,
    string_agg(DISTINCT c.svi_user_id, ', ') AS svi_user_id,
    string_agg(DISTINCT NULLIF(CONCAT_WS(' ', svi_u.prenom, svi_u.nom_de_famille), ''), ', ') AS svi_user_name,
    string_agg(DISTINCT c.svi_closed_by_user_id, ', ') AS svi_closed_by_user_id
  FROM "Carcasse" c
  LEFT JOIN "User" cur_u ON cur_u.id = c.current_owner_user_id
  LEFT JOIN "Entity" cur_e ON cur_e.id = c.current_owner_entity_id
  LEFT JOIN "User" next_u ON next_u.id = c.next_owner_user_id
  LEFT JOIN "Entity" next_e ON next_e.id = c.next_owner_entity_id
  LEFT JOIN "Entity" svi_e ON svi_e.id = c.svi_entity_id
  LEFT JOIN "User" svi_u ON svi_u.id = c.svi_user_id
  WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL
) agg ON true;
