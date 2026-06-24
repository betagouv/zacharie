-- Question     : Funnel FEI — nombre de FEI ayant atteint chaque étape
-- Dashboard     : Tunnel FEI
-- Viz conseillée : Funnel (ou barres horizontales) — Metabase n'ordonne pas le funnel,
--                  on garde donc la colonne "etape_ordre" pour trier (X = stage, Y = nb_fei).
-- Regroupement  : par étape du parcours (1 ligne par étape)
--
-- Étapes (chaque FEI est comptée à une étape si elle l'a ATTEINTE, cumulatif décroissant) :
--   1. Créée
--   2. Examen initial approuvé (mise sur le marché)
--   3. Transmise à un 1er détenteur (identité PD renseignée — voir NOTE)
--   4. Transmise à un intermédiaire (ETG/collecteur : au moins 1 CarcasseIntermediaire)
--   5. Reçue par un ETG (prise_en_charge_at sur un intermédiaire de rôle ETG)
--   6. Assignée à un SVI (au moins 1 carcasse avec svi_assigned_at)
--   7. Inspectée par le SVI (au moins 1 carcasse avec svi_ipm1_signed_at)
--   8. Clôturée (au moins 1 carcasse avec svi_closed_at ou svi_automatic_closed_at)
--
-- NOTE étape 3 : il n'existe PAS de timestamp "transmise au 1er détenteur" dans le schéma.
--   On se rabat sur l'identité du premier détenteur (premier_detenteur_user_id/entity_id).
--   Pour le DÉLAI de cette transmission, voir delais-medians-etapes.sql (dérivé du Log).
--
-- Filtres Metabase : {{from}} / {{to}} = bornes sur Fei.created_at (date de création de la fiche).
--   Variables optionnelles (la requête tourne sans) grâce aux blocs [[ ]].

WITH fei_steps AS (
  SELECT
    f.numero,
    (f.examinateur_initial_date_approbation_mise_sur_le_marche IS NOT NULL) AS exam_approuve,
    (f.premier_detenteur_user_id IS NOT NULL OR f.premier_detenteur_entity_id IS NOT NULL) AS a_premier_detenteur,
    EXISTS (
      SELECT 1 FROM "CarcasseIntermediaire" ci
      WHERE ci.fei_numero = f.numero AND ci.deleted_at IS NULL
    ) AS transmise_intermediaire,
    EXISTS (
      SELECT 1 FROM "CarcasseIntermediaire" ci
      WHERE ci.fei_numero = f.numero AND ci.deleted_at IS NULL
        AND ci.intermediaire_role = 'ETG' AND ci.prise_en_charge_at IS NOT NULL
    ) AS recue_etg,
    EXISTS (
      SELECT 1 FROM "Carcasse" c
      WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL AND c.svi_assigned_at IS NOT NULL
    ) AS assignee_svi,
    EXISTS (
      SELECT 1 FROM "Carcasse" c
      WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL AND c.svi_ipm1_signed_at IS NOT NULL
    ) AS inspectee_svi,
    EXISTS (
      SELECT 1 FROM "Carcasse" c
      WHERE c.fei_numero = f.numero AND c.deleted_at IS NULL
        AND (c.svi_closed_at IS NOT NULL OR c.svi_automatic_closed_at IS NOT NULL)
    ) AS cloturee
  FROM "Fei" f
  WHERE f.deleted_at IS NULL
    AND f.created_by_user_id NOT LIKE '%GLOP%'  -- exclure les fiches de test
    [[ AND f.created_at >= {{from}} ]]
    [[ AND f.created_at <= {{to}} ]]
    [[ AND SUBSTRING(f.commune_mise_a_mort FROM 1 FOR 2) = {{departement}} ]]
)
SELECT 1 AS etape_ordre, '1. Créée'                    AS etape, COUNT(*)                                          AS nb_fei FROM fei_steps
UNION ALL
SELECT 2, '2. Examen initial approuvé',  COUNT(*) FILTER (WHERE exam_approuve)            FROM fei_steps
UNION ALL
SELECT 3, '3. Transmise au 1er détenteur', COUNT(*) FILTER (WHERE a_premier_detenteur)   FROM fei_steps
UNION ALL
SELECT 4, '4. Transmise à un intermédiaire', COUNT(*) FILTER (WHERE transmise_intermediaire) FROM fei_steps
UNION ALL
SELECT 5, '5. Reçue par un ETG',         COUNT(*) FILTER (WHERE recue_etg)                FROM fei_steps
UNION ALL
SELECT 6, '6. Assignée à un SVI',        COUNT(*) FILTER (WHERE assignee_svi)             FROM fei_steps
UNION ALL
SELECT 7, '7. Inspectée par le SVI',     COUNT(*) FILTER (WHERE inspectee_svi)            FROM fei_steps
UNION ALL
SELECT 8, '8. Clôturée',                 COUNT(*) FILTER (WHERE cloturee)                 FROM fei_steps
ORDER BY etape_ordre;
