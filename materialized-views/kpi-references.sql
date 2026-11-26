-- Requêtes des 9 KPI du tableau de bord Metabase #18 (références nationales et OFB).
--
-- Rien n'est matérialisé : chaque requête est autonome, à coller dans une question SQL Metabase.
-- Le commentaire au-dessus de chaque requête est le titre du bloc texte Metabase correspondant.
--
-- Sources :
-- - vues « données propres » de clean-views.sql : carcasse_view, fei_view. Les étapes intermédiaires sont lues
--   dans "CarcasseIntermediaire" (deleted_at IS NULL) pour des carcasses déjà filtrées par carcasse_view ;
-- - stats_ref_national : volumes, objectifs et taux nationaux, saisis dans l'admin (/app/admin/stats-ref).
--   Volumes en carcasses, taux et objectifs en pourcentage (45 = 45 %) ;
-- - stats_ref_ofb_tableau_chasse : tableaux de chasse OFB par département, importés par
--   api-express/scripts/20261110_import_ofb_tableau_chasse.sql.
--
-- Briques communes, répétées dans chaque requête (une question Metabase = une requête) :
-- - saison d'une carcasse : du 1er juin au 31 mai, d'après sa date de mise à mort (celle de la fiche
--   à défaut). Format « 2025-2026 », comme stats_ref_national.saison ;
-- - volume : 1 par carcasse de grand gibier, `nombre_d_animaux` par lot de petit gibier ;
-- - circuit long : carcasse non gardée pour usage domestique dont un détenteur est un ETG, un SVI ou un
--   collecteur pro (propriétaire courant, précédent ou suivant, ligne intermédiaire, dépôt du premier
--   détenteur en ETG), même en route ; refus et manquantes inclus ;
-- - circuit court : règle « nonAgree » de getCircuitValorisation (api-express/src/utils/federation-stats.ts) :
--   non domestique, jamais passée par un ETG / SVI, destinataire du circuit court ;
-- - volume de référence d'une saison : VOLUME_GLOBAL de la saison précédente la plus récente
--   (n-1 si elle existe, sinon la dernière connue). Sans référence, la part est vide.


-- 1. Circuit long — grand gibier : part des carcasses tracées dans Zacharie
WITH etapes_circuit_long AS (
    -- lignes intermédiaires lues une seule fois (un EXISTS sur carcasse_intermediaire_view recalcule
    -- les vues par carcasse et dépasse le délai de Metabase) ; la carcasse est déjà filtrée par carcasse_view
    SELECT DISTINCT zacharie_carcasse_id
    FROM "CarcasseIntermediaire"
    WHERE deleted_at IS NULL AND intermediaire_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
),
carcasses AS (
    SELECT
        to_char(COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months', 'YYYY') || '-' ||
            (extract(year FROM COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months')::int + 1) AS saison,
        CASE WHEN c.type = 'PETIT_GIBIER' THEN COALESCE(c.nombre_d_animaux, 1) ELSE 1 END AS volume
    FROM carcasse_view c
    JOIN fei_view f ON f.numero = c.fei_numero
    WHERE c.type = 'GROS_GIBIER'
      AND COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) IS NOT NULL
      AND c.consommateur_final_usage_domestique IS NULL
      AND (
          c.premier_detenteur_depot_type = 'ETG'
          OR c.current_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.prev_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.next_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.zacharie_carcasse_id IN (SELECT zacharie_carcasse_id FROM etapes_circuit_long)
      )
),
saisons AS (
    SELECT saison, SUM(volume) AS carcasses_tracees FROM carcasses GROUP BY saison
)
SELECT
    s.saison,
    s.carcasses_tracees,
    ref.valeur AS volume_reference,
    ROUND((100.0 * s.carcasses_tracees / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct
FROM saisons s
LEFT JOIN LATERAL (
    SELECT r.valeur
    FROM stats_ref_national r
    WHERE r.circuit = 'LONG' AND r.type_gibier = 'GROS_GIBIER' AND r.indicateur = 'VOLUME_GLOBAL'
      AND r.saison < s.saison
    ORDER BY r.saison DESC
    LIMIT 1
) ref ON true
ORDER BY s.saison;


-- 2. Circuit long — petit gibier : part des animaux tracés dans Zacharie
WITH etapes_circuit_long AS (
    -- lignes intermédiaires lues une seule fois (un EXISTS sur carcasse_intermediaire_view recalcule
    -- les vues par carcasse et dépasse le délai de Metabase) ; la carcasse est déjà filtrée par carcasse_view
    SELECT DISTINCT zacharie_carcasse_id
    FROM "CarcasseIntermediaire"
    WHERE deleted_at IS NULL AND intermediaire_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
),
carcasses AS (
    SELECT
        to_char(COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months', 'YYYY') || '-' ||
            (extract(year FROM COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months')::int + 1) AS saison,
        CASE WHEN c.type = 'PETIT_GIBIER' THEN COALESCE(c.nombre_d_animaux, 1) ELSE 1 END AS volume
    FROM carcasse_view c
    JOIN fei_view f ON f.numero = c.fei_numero
    WHERE c.type = 'PETIT_GIBIER'
      AND COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) IS NOT NULL
      AND c.consommateur_final_usage_domestique IS NULL
      AND (
          c.premier_detenteur_depot_type = 'ETG'
          OR c.current_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.prev_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.next_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.zacharie_carcasse_id IN (SELECT zacharie_carcasse_id FROM etapes_circuit_long)
      )
),
saisons AS (
    SELECT saison, SUM(volume) AS animaux_traces FROM carcasses GROUP BY saison
)
SELECT
    s.saison,
    s.animaux_traces,
    ref.valeur AS volume_reference,
    ROUND((100.0 * s.animaux_traces / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct
FROM saisons s
LEFT JOIN LATERAL (
    SELECT r.valeur
    FROM stats_ref_national r
    WHERE r.circuit = 'LONG' AND r.type_gibier = 'PETIT_GIBIER' AND r.indicateur = 'VOLUME_GLOBAL'
      AND r.saison < s.saison
    ORDER BY r.saison DESC
    LIMIT 1
) ref ON true
ORDER BY s.saison;


-- 3. Jauge circuit long — grand gibier : part tracée de la saison en cours vs objectif
WITH etapes_circuit_long AS (
    -- lignes intermédiaires lues une seule fois (un EXISTS sur carcasse_intermediaire_view recalcule
    -- les vues par carcasse et dépasse le délai de Metabase) ; la carcasse est déjà filtrée par carcasse_view
    SELECT DISTINCT zacharie_carcasse_id
    FROM "CarcasseIntermediaire"
    WHERE deleted_at IS NULL AND intermediaire_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
),
saison_en_cours AS (
    SELECT to_char(CURRENT_DATE - interval '5 months', 'YYYY') || '-' ||
        (extract(year FROM CURRENT_DATE - interval '5 months')::int + 1) AS saison
),
carcasses AS (
    SELECT
        to_char(COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months', 'YYYY') || '-' ||
            (extract(year FROM COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months')::int + 1) AS saison,
        CASE WHEN c.type = 'PETIT_GIBIER' THEN COALESCE(c.nombre_d_animaux, 1) ELSE 1 END AS volume
    FROM carcasse_view c
    JOIN fei_view f ON f.numero = c.fei_numero
    WHERE c.type = 'GROS_GIBIER'
      AND COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) IS NOT NULL
      AND c.consommateur_final_usage_domestique IS NULL
      AND (
          c.premier_detenteur_depot_type = 'ETG'
          OR c.current_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.prev_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.next_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.zacharie_carcasse_id IN (SELECT zacharie_carcasse_id FROM etapes_circuit_long)
      )
)
-- part_tracee_pct en première colonne : la jauge Metabase affiche la première valeur de la première ligne
SELECT
    ROUND((100.0 * (SELECT COALESCE(SUM(volume), 0) FROM carcasses WHERE saison = s.saison)
        / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct,
    obj.valeur AS objectif_pct,
    s.saison
FROM saison_en_cours s
LEFT JOIN LATERAL (
    SELECT r.valeur
    FROM stats_ref_national r
    WHERE r.circuit = 'LONG' AND r.type_gibier = 'GROS_GIBIER' AND r.indicateur = 'VOLUME_GLOBAL'
      AND r.saison < s.saison
    ORDER BY r.saison DESC
    LIMIT 1
) ref ON true
LEFT JOIN stats_ref_national obj
    ON obj.saison = s.saison AND obj.circuit = 'LONG' AND obj.type_gibier = 'GROS_GIBIER'
    AND obj.indicateur = 'OBJECTIF_PART_TRACEE';


-- 4. Jauge circuit long — petit gibier : part tracée de la saison en cours vs objectif
WITH etapes_circuit_long AS (
    -- lignes intermédiaires lues une seule fois (un EXISTS sur carcasse_intermediaire_view recalcule
    -- les vues par carcasse et dépasse le délai de Metabase) ; la carcasse est déjà filtrée par carcasse_view
    SELECT DISTINCT zacharie_carcasse_id
    FROM "CarcasseIntermediaire"
    WHERE deleted_at IS NULL AND intermediaire_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
),
saison_en_cours AS (
    SELECT to_char(CURRENT_DATE - interval '5 months', 'YYYY') || '-' ||
        (extract(year FROM CURRENT_DATE - interval '5 months')::int + 1) AS saison
),
carcasses AS (
    SELECT
        to_char(COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months', 'YYYY') || '-' ||
            (extract(year FROM COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months')::int + 1) AS saison,
        CASE WHEN c.type = 'PETIT_GIBIER' THEN COALESCE(c.nombre_d_animaux, 1) ELSE 1 END AS volume
    FROM carcasse_view c
    JOIN fei_view f ON f.numero = c.fei_numero
    WHERE c.type = 'PETIT_GIBIER'
      AND COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) IS NOT NULL
      AND c.consommateur_final_usage_domestique IS NULL
      AND (
          c.premier_detenteur_depot_type = 'ETG'
          OR c.current_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.prev_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.next_owner_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          OR c.zacharie_carcasse_id IN (SELECT zacharie_carcasse_id FROM etapes_circuit_long)
      )
)
-- part_tracee_pct en première colonne : la jauge Metabase affiche la première valeur de la première ligne
SELECT
    ROUND((100.0 * (SELECT COALESCE(SUM(volume), 0) FROM carcasses WHERE saison = s.saison)
        / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct,
    obj.valeur AS objectif_pct,
    s.saison
FROM saison_en_cours s
LEFT JOIN LATERAL (
    SELECT r.valeur
    FROM stats_ref_national r
    WHERE r.circuit = 'LONG' AND r.type_gibier = 'PETIT_GIBIER' AND r.indicateur = 'VOLUME_GLOBAL'
      AND r.saison < s.saison
    ORDER BY r.saison DESC
    LIMIT 1
) ref ON true
LEFT JOIN stats_ref_national obj
    ON obj.saison = s.saison AND obj.circuit = 'LONG' AND obj.type_gibier = 'PETIT_GIBIER'
    AND obj.indicateur = 'OBJECTIF_PART_TRACEE';


-- 5. Circuit court — grand gibier : part des carcasses tracées dans Zacharie
WITH etapes_etg AS (
    -- lignes intermédiaires lues une seule fois (un EXISTS sur carcasse_intermediaire_view recalcule
    -- les vues par carcasse et dépasse le délai de Metabase) ; la carcasse est déjà filtrée par carcasse_view
    SELECT DISTINCT zacharie_carcasse_id
    FROM "CarcasseIntermediaire"
    WHERE deleted_at IS NULL AND zacharie_carcasse_id IS NOT NULL AND intermediaire_role = 'ETG'
),
carcasses AS (
    SELECT
        to_char(COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months', 'YYYY') || '-' ||
            (extract(year FROM COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months')::int + 1) AS saison,
        CASE WHEN c.type = 'PETIT_GIBIER' THEN COALESCE(c.nombre_d_animaux, 1) ELSE 1 END AS volume
    FROM carcasse_view c
    JOIN fei_view f ON f.numero = c.fei_numero
    WHERE c.type = 'GROS_GIBIER'
      AND COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) IS NOT NULL
      AND c.consommateur_final_usage_domestique IS NULL
      AND c.premier_detenteur_depot_type IS DISTINCT FROM 'ETG'
      AND c.current_owner_role IS DISTINCT FROM 'ETG' AND c.current_owner_role IS DISTINCT FROM 'SVI'
      AND c.prev_owner_role IS DISTINCT FROM 'ETG' AND c.prev_owner_role IS DISTINCT FROM 'SVI'
      AND c.zacharie_carcasse_id NOT IN (SELECT zacharie_carcasse_id FROM etapes_etg)
      AND COALESCE(c.next_owner_role, c.current_owner_role) IN (
          'COMMERCE_DE_DETAIL', 'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CANTINE_OU_RESTAURATION_COLLECTIVE',
          'ASSOCIATION_CARITATIVE', 'CONSOMMATEUR_FINAL', 'CIRCUIT_COURT'
      )
),
saisons AS (
    SELECT saison, SUM(volume) AS carcasses_tracees FROM carcasses GROUP BY saison
)
SELECT
    s.saison,
    s.carcasses_tracees,
    ref.valeur AS volume_reference,
    ROUND((100.0 * s.carcasses_tracees / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct
FROM saisons s
LEFT JOIN LATERAL (
    SELECT r.valeur
    FROM stats_ref_national r
    WHERE r.circuit = 'COURT' AND r.type_gibier = 'GROS_GIBIER' AND r.indicateur = 'VOLUME_GLOBAL'
      AND r.saison < s.saison
    ORDER BY r.saison DESC
    LIMIT 1
) ref ON true
ORDER BY s.saison;


-- 6. Jauge circuit court — grand gibier : part tracée de la saison en cours vs objectif
WITH etapes_etg AS (
    -- lignes intermédiaires lues une seule fois (un EXISTS sur carcasse_intermediaire_view recalcule
    -- les vues par carcasse et dépasse le délai de Metabase) ; la carcasse est déjà filtrée par carcasse_view
    SELECT DISTINCT zacharie_carcasse_id
    FROM "CarcasseIntermediaire"
    WHERE deleted_at IS NULL AND zacharie_carcasse_id IS NOT NULL AND intermediaire_role = 'ETG'
),
saison_en_cours AS (
    SELECT to_char(CURRENT_DATE - interval '5 months', 'YYYY') || '-' ||
        (extract(year FROM CURRENT_DATE - interval '5 months')::int + 1) AS saison
),
carcasses AS (
    SELECT
        to_char(COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months', 'YYYY') || '-' ||
            (extract(year FROM COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months')::int + 1) AS saison,
        CASE WHEN c.type = 'PETIT_GIBIER' THEN COALESCE(c.nombre_d_animaux, 1) ELSE 1 END AS volume
    FROM carcasse_view c
    JOIN fei_view f ON f.numero = c.fei_numero
    WHERE c.type = 'GROS_GIBIER'
      AND COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) IS NOT NULL
      AND c.consommateur_final_usage_domestique IS NULL
      AND c.premier_detenteur_depot_type IS DISTINCT FROM 'ETG'
      AND c.current_owner_role IS DISTINCT FROM 'ETG' AND c.current_owner_role IS DISTINCT FROM 'SVI'
      AND c.prev_owner_role IS DISTINCT FROM 'ETG' AND c.prev_owner_role IS DISTINCT FROM 'SVI'
      AND c.zacharie_carcasse_id NOT IN (SELECT zacharie_carcasse_id FROM etapes_etg)
      AND COALESCE(c.next_owner_role, c.current_owner_role) IN (
          'COMMERCE_DE_DETAIL', 'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CANTINE_OU_RESTAURATION_COLLECTIVE',
          'ASSOCIATION_CARITATIVE', 'CONSOMMATEUR_FINAL', 'CIRCUIT_COURT'
      )
)
-- part_tracee_pct en première colonne : la jauge Metabase affiche la première valeur de la première ligne
SELECT
    ROUND((100.0 * (SELECT COALESCE(SUM(volume), 0) FROM carcasses WHERE saison = s.saison)
        / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct,
    obj.valeur AS objectif_pct,
    s.saison
FROM saison_en_cours s
LEFT JOIN LATERAL (
    SELECT r.valeur
    FROM stats_ref_national r
    WHERE r.circuit = 'COURT' AND r.type_gibier = 'GROS_GIBIER' AND r.indicateur = 'VOLUME_GLOBAL'
      AND r.saison < s.saison
    ORDER BY r.saison DESC
    LIMIT 1
) ref ON true
LEFT JOIN stats_ref_national obj
    ON obj.saison = s.saison AND obj.circuit = 'COURT' AND obj.type_gibier = 'GROS_GIBIER'
    AND obj.indicateur = 'OBJECTIF_PART_TRACEE';


-- 7. Tableaux de chasse OFB — grand gibier par département
-- Une saison à la fois : la table couvre toutes les saisons depuis 1973, et Metabase tronque à 2 000 lignes.
-- Variable Metabase `saison` (texte, optionnelle, ex. « 2025-2026 ») ; sans valeur, dernière saison importée.
-- Libellés d'espèces repris de app-local-first-react-router/src/data/grand-gibier.json, mêmes libellés
-- que le CSV d'import (jeu OFB « Tableaux de chasse départementaux du Grand Gibier » sur data.gouv.fr).
SELECT
    departement,
    SUM(nombre) AS nombre
FROM stats_ref_ofb_tableau_chasse
WHERE espece IN (
    'Cerf élaphe', 'Cerf sika', 'Chevreuil', 'Daim', 'Sanglier', 'Chamois', 'Isard', 'Mouflon méditerranéen'
)
  AND saison = COALESCE([[{{saison}},]] (SELECT MAX(saison) FROM stats_ref_ofb_tableau_chasse))
GROUP BY departement
ORDER BY departement;


-- 8. Taux de saisie national n-1 — grand gibier
-- Chiffre affiché à côté du taux de saisie Zacharie (question #313) : taux national du circuit long de la
-- saison précédente la plus récente saisie dans l'admin. En fraction (0,239 = 23,9 %), pour le format
-- pourcentage du chiffre Metabase, comme les questions #313 et #328.
SELECT
    r.valeur / 100 AS taux_saisie_national,
    r.saison
FROM stats_ref_national r
WHERE r.circuit = 'LONG'
  AND r.type_gibier = 'GROS_GIBIER'
  AND r.indicateur = 'TAUX_SAISIE'
  AND r.saison < to_char(now() - interval '5 months', 'YYYY') || '-' ||
      (extract(year FROM now() - interval '5 months')::int + 1)
ORDER BY r.saison DESC
LIMIT 1;


-- 9. Taux de saisie BPH hors Zacharie n-1 — grand gibier
-- Chiffre affiché à côté du taux de saisie BPH Zacharie (question #328) : même règle et même format que le KPI 8.
SELECT
    r.valeur / 100 AS taux_saisie_bph_hors_zacharie,
    r.saison
FROM stats_ref_national r
WHERE r.circuit = 'LONG'
  AND r.type_gibier = 'GROS_GIBIER'
  AND r.indicateur = 'TAUX_SAISIE_BPH_HORS_ZACHARIE'
  AND r.saison < to_char(now() - interval '5 months', 'YYYY') || '-' ||
      (extract(year FROM now() - interval '5 months')::int + 1)
ORDER BY r.saison DESC
LIMIT 1;
