-- Requêtes des 9 KPI du tableau de bord Metabase #18 (références nationales et OFB).
--
-- Rien n'est matérialisé : chaque requête est autonome, à coller dans une question SQL Metabase.
-- Le commentaire au-dessus de chaque requête est le titre du bloc texte Metabase correspondant.
--
-- Sources :
-- - vues « données propres » de clean-views.sql : carcasse_view, fei_view, carcasse_intermediaire_view ;
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
WITH carcasses AS (
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
          OR EXISTS (
              SELECT 1 FROM carcasse_intermediaire_view ci
              WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id
                AND ci.intermediaire_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          )
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
WITH carcasses AS (
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
          OR EXISTS (
              SELECT 1 FROM carcasse_intermediaire_view ci
              WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id
                AND ci.intermediaire_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          )
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
WITH saison_en_cours AS (
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
          OR EXISTS (
              SELECT 1 FROM carcasse_intermediaire_view ci
              WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id
                AND ci.intermediaire_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          )
      )
)
SELECT
    s.saison,
    ROUND((100.0 * (SELECT COALESCE(SUM(volume), 0) FROM carcasses WHERE saison = s.saison)
        / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct,
    obj.valeur AS objectif_pct
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
WITH saison_en_cours AS (
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
          OR EXISTS (
              SELECT 1 FROM carcasse_intermediaire_view ci
              WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id
                AND ci.intermediaire_role IN ('ETG', 'SVI', 'COLLECTEUR_PRO')
          )
      )
)
SELECT
    s.saison,
    ROUND((100.0 * (SELECT COALESCE(SUM(volume), 0) FROM carcasses WHERE saison = s.saison)
        / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct,
    obj.valeur AS objectif_pct
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
WITH carcasses AS (
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
      AND NOT EXISTS (
          SELECT 1 FROM carcasse_intermediaire_view ci
          WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id AND ci.intermediaire_role = 'ETG'
      )
      AND COALESCE(c.next_owner_role, c.current_owner_role) IN (
          'COMMERCE_DE_DETAIL', 'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CANTINE_OU_RESTAURATION_COLLECTIVE',
          'ASSOCIATION_CARITATIVE', 'CONSOMMATEUR_FINAL'
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
WITH saison_en_cours AS (
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
      AND NOT EXISTS (
          SELECT 1 FROM carcasse_intermediaire_view ci
          WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id AND ci.intermediaire_role = 'ETG'
      )
      AND COALESCE(c.next_owner_role, c.current_owner_role) IN (
          'COMMERCE_DE_DETAIL', 'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CANTINE_OU_RESTAURATION_COLLECTIVE',
          'ASSOCIATION_CARITATIVE', 'CONSOMMATEUR_FINAL'
      )
)
SELECT
    s.saison,
    ROUND((100.0 * (SELECT COALESCE(SUM(volume), 0) FROM carcasses WHERE saison = s.saison)
        / NULLIF(ref.valeur, 0))::numeric, 1) AS part_tracee_pct,
    obj.valeur AS objectif_pct
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
-- Libellés d'espèces repris de app-local-first-react-router/src/data/grand-gibier.json : à ajuster
-- sur les libellés du premier CSV OFB importé.
SELECT
    saison,
    departement,
    SUM(nombre) AS nombre
FROM stats_ref_ofb_tableau_chasse
WHERE espece IN (
    'Cerf élaphe', 'Cerf sika', 'Chevreuil', 'Daim', 'Sanglier', 'Chamois', 'Isard', 'Mouflon méditerranéen'
)
GROUP BY saison, departement
ORDER BY saison, departement;


-- 8. Taux de saisie : Zacharie vs national
-- Base : carcasses inspectées par un SVI avec une décision finale (même filtre que carcasse_svi_stats),
-- pondérées en animaux.
WITH carcasses AS (
    SELECT
        to_char(COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months', 'YYYY') || '-' ||
            (extract(year FROM COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months')::int + 1) AS saison,
        c.type AS type_gibier,
        COALESCE(c.nombre_d_animaux, 1) AS animaux,
        CASE
            WHEN c.svi_carcasse_status IN ('SAISIE_TOTALE', 'SAISIE_PARTIELLE')
                THEN COALESCE(c.svi_ipm2_nombre_animaux, c.nombre_d_animaux, 1)
            ELSE 0
        END AS animaux_saisis
    FROM carcasse_view c
    JOIN fei_view f ON f.numero = c.fei_numero
    WHERE c.svi_assigned_at IS NOT NULL
      AND c.type IS NOT NULL
      AND COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) IS NOT NULL
      AND c.svi_carcasse_status NOT IN (
          'MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'SANS_DECISION', 'CONSIGNE', 'MANQUANTE_SVI'
      )
),
saisons AS (
    SELECT saison, type_gibier, SUM(animaux) AS animaux, SUM(animaux_saisis) AS animaux_saisis
    FROM carcasses
    GROUP BY saison, type_gibier
)
SELECT
    s.saison,
    s.type_gibier,
    s.animaux,
    s.animaux_saisis,
    ROUND((100.0 * s.animaux_saisis / NULLIF(s.animaux, 0))::numeric, 1) AS taux_saisie_zacharie_pct,
    ref.valeur AS taux_saisie_national_pct
FROM saisons s
LEFT JOIN stats_ref_national ref
    ON ref.saison = s.saison AND ref.circuit = 'LONG' AND ref.type_gibier = s.type_gibier
    AND ref.indicateur = 'TAUX_SAISIE'
ORDER BY s.saison, s.type_gibier;


-- 9. Taux de saisie BPH : dans et hors Zacharie
-- Motifs BPH : règle de la question Metabase #388. Libellés accentués, « œufs » en ligature
-- (cf app-local-first-react-router/src/utils/bph-motifs.ts). Même base et même pondération que le KPI 8.
WITH carcasses AS (
    SELECT
        to_char(COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months', 'YYYY') || '-' ||
            (extract(year FROM COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) - interval '5 months')::int + 1) AS saison,
        c.type AS type_gibier,
        COALESCE(c.nombre_d_animaux, 1) AS animaux,
        CASE
            WHEN c.svi_carcasse_status IN ('SAISIE_TOTALE', 'SAISIE_PARTIELLE')
                AND EXISTS (
                    SELECT 1 FROM unnest(c.svi_ipm2_lesions_ou_motifs) m
                    WHERE m ILIKE ANY (ARRAY[
                        '%abdomen%', '%souillure%', '%douchage%', '%odeur%', '%putréfaction%', '%moisissure%',
                        '%œuf%', '%oeuf%', '%larve%', '%morsure%', '%anormal%'
                    ])
                )
                THEN COALESCE(c.svi_ipm2_nombre_animaux, c.nombre_d_animaux, 1)
            ELSE 0
        END AS animaux_saisis_bph
    FROM carcasse_view c
    JOIN fei_view f ON f.numero = c.fei_numero
    WHERE c.svi_assigned_at IS NOT NULL
      AND c.type IS NOT NULL
      AND COALESCE(c.date_mise_a_mort, f.date_mise_a_mort) IS NOT NULL
      AND c.svi_carcasse_status NOT IN (
          'MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'SANS_DECISION', 'CONSIGNE', 'MANQUANTE_SVI'
      )
),
saisons AS (
    SELECT saison, type_gibier, SUM(animaux) AS animaux, SUM(animaux_saisis_bph) AS animaux_saisis_bph
    FROM carcasses
    GROUP BY saison, type_gibier
)
SELECT
    s.saison,
    s.type_gibier,
    s.animaux,
    s.animaux_saisis_bph,
    ROUND((100.0 * s.animaux_saisis_bph / NULLIF(s.animaux, 0))::numeric, 1) AS taux_saisie_bph_zacharie_pct,
    ref.valeur AS taux_saisie_bph_hors_zacharie_pct
FROM saisons s
LEFT JOIN stats_ref_national ref
    ON ref.saison = s.saison AND ref.circuit = 'LONG' AND ref.type_gibier = s.type_gibier
    AND ref.indicateur = 'TAUX_SAISIE_BPH_HORS_ZACHARIE'
ORDER BY s.saison, s.type_gibier;
