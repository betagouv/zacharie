DROP MATERIALIZED VIEW IF EXISTS carcasse_svi_stats;

CREATE MATERIALIZED VIEW carcasse_svi_stats AS
SELECT 
    CASE 
        WHEN c.svi_carcasse_saisie_motif IS NULL 
             OR c.svi_carcasse_saisie_motif = '{}' THEN 'Aucun motif de saisie'
        ELSE array_to_string(c.svi_carcasse_saisie_motif::text[], ', ')
    END as svi_carcasse_saisie_motif,
    COUNT(*) as count
FROM "Carcasse" c
JOIN "Fei" f ON c.fei_numero = f.numero
WHERE 
    c.deleted_at IS NULL 
    AND f.svi_assigned_at IS NOT NULL
    AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
    AND (c.intermediaire_carcasse_manquante IS NULL OR c.intermediaire_carcasse_manquante = false)
GROUP BY 
    CASE 
        WHEN c.svi_carcasse_saisie_motif IS NULL 
             OR c.svi_carcasse_saisie_motif = '{}' THEN 'Aucun motif de saisie'
        ELSE array_to_string(c.svi_carcasse_saisie_motif::text[], ', ')
    END;

CREATE UNIQUE INDEX ON carcasse_svi_stats (svi_carcasse_saisie_motif);