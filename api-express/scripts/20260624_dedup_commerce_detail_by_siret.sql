-- Déduplication des commerces de détail créés à la main, par SIRET.
--
-- Contexte : avant l'annuaire, chaque chasseur saisissait lui-même son commerce de détail
-- (nom + SIRET libre), ce qui a créé des doublons (deux chasseurs pour le même boucher = deux
-- entités distinctes). L'annuaire dédoublonne désormais à la création (upsert par SIRET).
-- Ce script fusionne les doublons HISTORIQUES : pour chaque SIRET partagé par plusieurs
-- COMMERCE_DE_DETAIL non supprimés, on garde le plus ancien (survivant), on re-pointe toutes les
-- clés étrangères vers lui, puis on soft-delete les autres.
--
-- À exécuter UNE FOIS, manuellement, AVANT la création de l'index unique partiel
-- (20260624_add_commerce_detail_siret_unique_index.sql), sinon l'index échouerait sur les doublons.
-- Ordre conseillé : prod d'abord, puis preprod.

BEGIN;

-- 1) Table de correspondance (perdant -> survivant). Survivant = plus ancien created_at, id en tie-break.
CREATE TEMP TABLE entity_dedup_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    siret,
    ROW_NUMBER() OVER (PARTITION BY siret ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY siret ORDER BY created_at ASC, id ASC) AS survivor_id
  FROM "Entity"
  WHERE type = 'COMMERCE_DE_DETAIL'
    AND siret IS NOT NULL
    AND siret <> ''
    AND deleted_at IS NULL
)
SELECT id AS loser_id, survivor_id
FROM ranked
WHERE rn > 1;

-- 2) Re-pointage des clés étrangères entity_id vers le survivant.

UPDATE "EntityAndUserRelations" t SET entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.entity_id = m.loser_id;

UPDATE "Log" t SET entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.entity_id = m.loser_id;

UPDATE "Fei" t SET premier_detenteur_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.premier_detenteur_entity_id = m.loser_id;
UPDATE "Fei" t SET premier_detenteur_depot_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.premier_detenteur_depot_entity_id = m.loser_id;
UPDATE "Fei" t SET intermediaire_closed_by_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.intermediaire_closed_by_entity_id = m.loser_id;
UPDATE "Fei" t SET latest_intermediaire_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.latest_intermediaire_entity_id = m.loser_id;
UPDATE "Fei" t SET svi_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.svi_entity_id = m.loser_id;
UPDATE "Fei" t SET fei_current_owner_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.fei_current_owner_entity_id = m.loser_id;
UPDATE "Fei" t SET fei_next_owner_sous_traite_by_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.fei_next_owner_sous_traite_by_entity_id = m.loser_id;
UPDATE "Fei" t SET fei_next_owner_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.fei_next_owner_entity_id = m.loser_id;
UPDATE "Fei" t SET fei_prev_owner_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.fei_prev_owner_entity_id = m.loser_id;
UPDATE "Fei" t SET premier_detenteur_prochain_detenteur_id_cache = m.survivor_id
FROM entity_dedup_map m WHERE t.premier_detenteur_prochain_detenteur_id_cache = m.loser_id;

UPDATE "Carcasse" t SET premier_detenteur_depot_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.premier_detenteur_depot_entity_id = m.loser_id;
UPDATE "Carcasse" t SET premier_detenteur_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.premier_detenteur_entity_id = m.loser_id;
UPDATE "Carcasse" t SET intermediaire_closed_by_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.intermediaire_closed_by_entity_id = m.loser_id;
UPDATE "Carcasse" t SET latest_intermediaire_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.latest_intermediaire_entity_id = m.loser_id;
UPDATE "Carcasse" t SET svi_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.svi_entity_id = m.loser_id;
UPDATE "Carcasse" t SET current_owner_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.current_owner_entity_id = m.loser_id;
UPDATE "Carcasse" t SET next_owner_sous_traite_by_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.next_owner_sous_traite_by_entity_id = m.loser_id;
UPDATE "Carcasse" t SET next_owner_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.next_owner_entity_id = m.loser_id;
UPDATE "Carcasse" t SET prev_owner_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.prev_owner_entity_id = m.loser_id;
UPDATE "Carcasse" t SET premier_detenteur_prochain_detenteur_id_cache = m.survivor_id
FROM entity_dedup_map m WHERE t.premier_detenteur_prochain_detenteur_id_cache = m.loser_id;

UPDATE "CarcasseIntermediaire" t SET intermediaire_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.intermediaire_entity_id = m.loser_id;
UPDATE "CarcasseIntermediaire" t SET intermediaire_depot_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.intermediaire_depot_entity_id = m.loser_id;
UPDATE "CarcasseIntermediaire" t SET intermediaire_prochain_detenteur_id_cache = m.survivor_id
FROM entity_dedup_map m WHERE t.intermediaire_prochain_detenteur_id_cache = m.loser_id;

UPDATE "ApiKey" t SET dedicated_to_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.dedicated_to_entity_id = m.loser_id;
UPDATE "ApiKeyApprovalByUserOrEntity" t SET entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.entity_id = m.loser_id;
UPDATE "ApiKeyLog" t SET entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.entity_id = m.loser_id;
UPDATE "CarcasseModificationRequest" t SET requested_by_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.requested_by_entity_id = m.loser_id;

-- Trichine (peu probable pour un commerce de détail, inclus par sécurité).
UPDATE "TrichineEchantillon" t SET preleve_par_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.preleve_par_entity_id = m.loser_id;
UPDATE "TrichinePool" t SET cree_par_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.cree_par_entity_id = m.loser_id;
UPDATE "TrichineFTP" t SET expediteur_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.expediteur_entity_id = m.loser_id;
UPDATE "TrichineFTP" t SET destinataire_entity_id = m.survivor_id
FROM entity_dedup_map m WHERE t.destinataire_entity_id = m.loser_id;

-- 3) Le re-pointage des relations a pu créer des doublons (owner_id, entity_id, relation).
--    On garde la plus ancienne et on soft-delete les autres pour préserver l'unicité métier.
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY owner_id, entity_id, relation
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM "EntityAndUserRelations"
  WHERE deleted_at IS NULL
    AND entity_id IN (SELECT survivor_id FROM entity_dedup_map)
)
UPDATE "EntityAndUserRelations" t
SET deleted_at = now()
FROM dups
WHERE t.id = dups.id AND dups.rn > 1;

-- 4) Soft-delete des entités perdantes.
UPDATE "Entity" t SET deleted_at = now()
FROM entity_dedup_map m WHERE t.id = m.loser_id;

COMMIT;
