-- Backfill de la clôture SVI au niveau carcasse (migration "option B").
--
-- Avant : la clôture SVI vivait sur Fei.svi_closed_at / Fei.automatic_closed_at,
--         et isFeiDone lisait ces flags FEI.
-- Après : la clôture vit PAR CARCASSE (Carcasse.svi_closed_at / svi_automatic_closed_at)
--         et isFeiDone se calcule depuis l'état terminal de chaque carcasse.
--
-- Sans ce backfill, certaines fiches déjà closes réapparaîtraient comme "non terminées"
-- (ex. une carcasse en CONSIGNE n'est pas un statut terminal : elle a besoin de
-- svi_closed_at pour être considérée close après la migration).
--
-- À exécuter UNE FOIS, manuellement, sur la base (prod puis preprod).
-- On exclut les carcasses refusées / manquantes en intermédiaire : elles ne sont jamais
-- passées par le SVI et sont déjà terminales par leur statut propre.

BEGIN;

-- 1) Clôture manuelle : Fei.svi_closed_at -> Carcasse.svi_closed_at
UPDATE "Carcasse" c
SET svi_closed_at = f.svi_closed_at,
    svi_closed_by_user_id = COALESCE(c.svi_closed_by_user_id, f.svi_closed_by_user_id)
FROM "Fei" f
WHERE c.fei_numero = f.numero
  AND f.svi_closed_at IS NOT NULL
  AND c.svi_closed_at IS NULL
  AND c.deleted_at IS NULL
  AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
  AND (c.intermediaire_carcasse_manquante IS NULL OR c.intermediaire_carcasse_manquante = false);

-- 2) Clôture automatique : Fei.automatic_closed_at -> Carcasse.svi_automatic_closed_at
UPDATE "Carcasse" c
SET svi_automatic_closed_at = f.automatic_closed_at
FROM "Fei" f
WHERE c.fei_numero = f.numero
  AND f.automatic_closed_at IS NOT NULL
  AND c.svi_automatic_closed_at IS NULL
  AND c.deleted_at IS NULL
  AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
  AND (c.intermediaire_carcasse_manquante IS NULL OR c.intermediaire_carcasse_manquante = false);

COMMIT;
