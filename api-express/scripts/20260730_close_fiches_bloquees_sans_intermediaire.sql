-- Clôture manuelle des fiches bloquées par une prise en charge orpheline.
--
-- Symptôme : des carcasses portent current_owner_role = ETG / COLLECTEUR_PRO alors qu'aucune
-- CarcasseIntermediaire ne rattache l'entité détentrice à la carcasse. Côté détenteur la fiche est
-- une impasse : pas de bouton « Prendre en charge » (next_owner vide) et pas de section de
-- transmission (elle est dérivée de l'intermédiaire). Le cron d'auto-clôture de 8h ne les rattrape
-- jamais : il ne balaie que les carcasses assignées au SVI (svi_assigned_at, ici NULL).
--
-- Réparation : on clôture toutes les carcasses NON TERMINALES des fiches listées ci-dessous, via
-- svi_automatic_closed_at. Le modèle Fei n'a plus aucune colonne de clôture (elle vit par carcasse
-- depuis 20260526_backfill_carcasse_svi_closed_at.sql) : « fermer la fiche » = fermer ses carcasses.
--
-- On ne touche PAS :
--   - svi_carcasse_status (reste SANS_DECISION) ni svi_carcasse_status_set_at : le passer à ACCEPTE
--     fabriquerait une décision sanitaire qui n'a pas eu lieu (et les emails afficheraient « Acceptée ») ;
--   - svi_assigned_at : pas d'inspection fictive ;
--   - current_owner_* ni la CarcasseIntermediaire manquante : la fiche clôturée n'est plus une impasse.
--
-- Aucune notification n'est envoyée (SQL pur, pas de side-effect applicatif).
--
-- À exécuter UNE FOIS, manuellement. Relire le SELECT de contrôle AVANT de COMMIT.
-- Diagnostic associé : 20260730_diag_carcasses_orphelines_sans_intermediaire.sql

BEGIN;

-- 1) Fiches cibles + classement terminale / non terminale, matérialisé une fois pour éviter de
--    répéter le prédicat. Le prédicat reflète isCarcasseDone
--    (app-local-first-react-router/src/utils/is-carcasse-done.ts, api-express/src/utils/is-carcasse-done.ts).
--    Chaque terme est null-safe (COALESCE / IS TRUE) : sans ça, un rôle NULL rend l'expression NULL
--    et la carcasse serait silencieusement écartée de l'UPDATE.
CREATE TEMP TABLE _fix_cibles AS
SELECT
  c.zacharie_carcasse_id,
  c.fei_numero,
  c.numero_bracelet,
  c.current_owner_role::text  AS current_owner_role,
  c.current_owner_entity_id,
  c.svi_carcasse_status::text AS svi_carcasse_status,
  (
    c.svi_closed_at IS NOT NULL
    OR c.svi_automatic_closed_at IS NOT NULL
    OR c.intermediaire_closed_at IS NOT NULL
    OR c.intermediaire_carcasse_refus_intermediaire_id IS NOT NULL
    OR c.intermediaire_carcasse_manquante IS TRUE
    OR c.consommateur_final_usage_domestique IS NOT NULL
    OR COALESCE(c.current_owner_role::text = ANY (ARRAY[
         'COMMERCE_DE_DETAIL', 'CANTINE_OU_RESTAURATION_COLLECTIVE', 'ASSOCIATION_CARITATIVE',
         'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CONSOMMATEUR_FINAL'
       ]), false)
    OR COALESCE(c.next_owner_role::text = ANY (ARRAY[
         'COMMERCE_DE_DETAIL', 'CANTINE_OU_RESTAURATION_COLLECTIVE', 'ASSOCIATION_CARITATIVE',
         'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CONSOMMATEUR_FINAL'
       ]), false)
    OR COALESCE(c.svi_carcasse_status::text = ANY (ARRAY[
         'ACCEPTE', 'MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'MANQUANTE_SVI',
         'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'LEVEE_DE_CONSIGNE', 'TRAITEMENT_ASSAINISSANT'
       ]), false)
  ) AS est_terminale
FROM "Carcasse" c
WHERE c.deleted_at IS NULL
  AND c.fei_numero IN (
    -- ⚠️ REMPLIR : les 4 numéros de fiche, tels que remontés par le bloc 2 du script de diagnostic.
    'A_REMPLIR_1',
    'A_REMPLIR_2',
    'A_REMPLIR_3',
    'A_REMPLIR_4'
  );

-- Garde-fou : liste non remplie / numéros erronés → on s'arrête au lieu de « réussir » sur 0 ligne.
DO $$
DECLARE nb integer;
BEGIN
  SELECT count(*) INTO nb FROM _fix_cibles;
  IF nb = 0 THEN
    RAISE EXCEPTION 'Aucune carcasse trouvée : la liste des fiches cibles est vide, non remplie ou erronée';
  END IF;
END $$;

-- 2) CONTRÔLE — à relire avant COMMIT.
-- 2a. Vue d'ensemble par fiche.
SELECT
  fei_numero,
  count(*)                                        AS nb_carcasses,
  count(*) FILTER (WHERE est_terminale)           AS deja_terminales,
  count(*) FILTER (WHERE NOT est_terminale)       AS a_fermer
FROM _fix_cibles
GROUP BY fei_numero
ORDER BY fei_numero;

-- 2b. Détail des carcasses qui vont être clôturées.
SELECT fei_numero, numero_bracelet, current_owner_role, current_owner_entity_id, svi_carcasse_status
FROM _fix_cibles
WHERE NOT est_terminale
ORDER BY fei_numero, numero_bracelet;

-- 3) Clôture + trace dans Log, en une seule instruction (le Log porte exactement les lignes mises à jour).
--    updated_at est bumpé explicitement : @updatedAt est géré par Prisma, pas par un trigger, et le
--    pull delta des clients filtre sur updated_at — sans ça, les postes ETG ne recevraient jamais la
--    clôture et la fiche resterait bloquée dans leur store local.
--    gen_random_uuid() : natif PG13+ (sinon CREATE EXTENSION pgcrypto).
WITH fermees AS (
  UPDATE "Carcasse" c
  SET svi_automatic_closed_at = now(),
      updated_at = now()
  FROM _fix_cibles f
  WHERE c.zacharie_carcasse_id = f.zacharie_carcasse_id
    AND NOT f.est_terminale
  RETURNING c.zacharie_carcasse_id, c.fei_numero, c.svi_automatic_closed_at
)
INSERT INTO "Log" (id, user_id, user_role, fei_numero, zacharie_carcasse_id, action, history, date, is_synced)
SELECT
  gen_random_uuid()::text,
  NULL,
  NULL,
  fermees.fei_numero,
  fermees.zacharie_carcasse_id,
  'data-fix-close-fiches-bloquees',
  jsonb_build_object(
    'before', jsonb_build_object('svi_automatic_closed_at', NULL),
    'after',  jsonb_build_object('svi_automatic_closed_at', fermees.svi_automatic_closed_at)
  ),
  now(),
  true
FROM fermees;

-- 4) VÉRIFICATION — relu depuis "Carcasse", doit renvoyer 0 ligne.
-- 4a. Plus aucune carcasse non terminale sur les fiches cibles.
SELECT c.fei_numero, c.numero_bracelet
FROM "Carcasse" c
JOIN _fix_cibles f ON f.zacharie_carcasse_id = c.zacharie_carcasse_id
WHERE c.deleted_at IS NULL
  AND c.svi_closed_at IS NULL
  AND c.svi_automatic_closed_at IS NULL
  AND c.intermediaire_closed_at IS NULL
  AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
  AND c.intermediaire_carcasse_manquante IS NOT TRUE
  AND c.consommateur_final_usage_domestique IS NULL
  AND NOT COALESCE(c.current_owner_role::text = ANY (ARRAY[
        'COMMERCE_DE_DETAIL', 'CANTINE_OU_RESTAURATION_COLLECTIVE', 'ASSOCIATION_CARITATIVE',
        'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CONSOMMATEUR_FINAL'
      ]), false)
  AND NOT COALESCE(c.next_owner_role::text = ANY (ARRAY[
        'COMMERCE_DE_DETAIL', 'CANTINE_OU_RESTAURATION_COLLECTIVE', 'ASSOCIATION_CARITATIVE',
        'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CONSOMMATEUR_FINAL'
      ]), false)
  AND NOT COALESCE(c.svi_carcasse_status::text = ANY (ARRAY[
        'ACCEPTE', 'MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'MANQUANTE_SVI',
        'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'LEVEE_DE_CONSIGNE', 'TRAITEMENT_ASSAINISSANT'
      ]), false)
ORDER BY c.fei_numero, c.numero_bracelet;

-- 4b. Prédicat du check data-health (cronjobs/data-health.ts) sur ces fiches : doit être à 0.
SELECT count(*) AS restent_orphelines_bloquantes
FROM "Carcasse" c
JOIN _fix_cibles f ON f.zacharie_carcasse_id = c.zacharie_carcasse_id
WHERE c.deleted_at IS NULL
  AND c.current_owner_role IN ('ETG', 'COLLECTEUR_PRO')
  AND c.current_owner_entity_id IS NOT NULL
  AND c.next_owner_role IS NULL
  AND c.svi_assigned_at IS NULL
  AND c.svi_closed_at IS NULL
  AND c.svi_automatic_closed_at IS NULL
  AND c.intermediaire_closed_at IS NULL
  AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
  AND c.intermediaire_carcasse_manquante IS NOT TRUE
  AND NOT EXISTS (
    SELECT 1 FROM "CarcasseIntermediaire" ci
    WHERE ci.zacharie_carcasse_id = c.zacharie_carcasse_id
      AND ci.deleted_at IS NULL
      AND ci.intermediaire_entity_id = c.current_owner_entity_id
  );

DROP TABLE _fix_cibles;

COMMIT;
