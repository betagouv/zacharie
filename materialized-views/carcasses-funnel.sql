DROP MATERIALIZED VIEW IF EXISTS carcasses_funnel_stats;

CREATE MATERIALIZED VIEW carcasses_funnel_stats AS
SELECT 
    'Nombre de carcasses total' as stage,
    COUNT(*) as count
FROM "Carcasse" c
WHERE c.deleted_at IS NULL

UNION ALL

SELECT 
    'Carcasses avec un destinataire' as stage,
    COUNT(DISTINCT c.zacharie_carcasse_id) as count
FROM "Carcasse" c
JOIN "FeiIntermediaire" fi ON c.fei_numero = fi.fei_numero
WHERE c.deleted_at IS NULL
  AND fi.deleted_at IS NULL

UNION ALL

SELECT 
    'Carcasses non refusées/manquantes' as stage,
    COUNT(DISTINCT c.zacharie_carcasse_id) as count
FROM "Carcasse" c
JOIN "FeiIntermediaire" fi ON c.fei_numero = fi.fei_numero
WHERE c.deleted_at IS NULL
  AND fi.deleted_at IS NULL
  AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL

UNION ALL

SELECT 
    'Carcasses assignées à un SVI' as stage,
    COUNT(DISTINCT c.zacharie_carcasse_id) as count
FROM "Carcasse" c
JOIN "Fei" f ON c.fei_numero = f.numero
WHERE c.deleted_at IS NULL
  AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
  AND (c.intermediaire_carcasse_manquante IS NULL OR c.intermediaire_carcasse_manquante = false)
  AND f.svi_assigned_at IS NOT NULL

UNION ALL

SELECT 
    'Carcasses non saisies par le SVI' as stage,
    COUNT(DISTINCT c.zacharie_carcasse_id) as count
FROM "Carcasse" c
JOIN "Fei" f ON c.fei_numero = f.numero
WHERE c.deleted_at IS NULL
  AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
  AND (c.intermediaire_carcasse_manquante IS NULL OR c.intermediaire_carcasse_manquante = false)
  AND f.svi_assigned_at IS NOT NULL
  AND c.svi_carcasse_status IN ('SANS_DECISION', 'ACCEPTE', 'LEVEE_DE_CONSIGNE', 'TRAITEMENT_ASSAINISSANT');

CREATE UNIQUE INDEX ON carcasses_funnel_stats (stage);