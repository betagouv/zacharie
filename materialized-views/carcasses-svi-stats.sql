DROP MATERIALIZED VIEW IF EXISTS carcasse_svi_stats;

CREATE MATERIALIZED VIEW carcasse_svi_stats AS
SELECT 
    CASE 
        WHEN c.svi_carcasse_status IN ('SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT') THEN
            CASE 
                WHEN c.svi_ipm2_lesions_ou_motifs IS NULL 
                     OR c.svi_ipm2_lesions_ou_motifs = '{}' THEN 'Aucun motif de saisie'
                ELSE array_to_string(c.svi_ipm2_lesions_ou_motifs::text[], ', ')
            END
        ELSE c.svi_carcasse_status::text
    END as status_or_motif,
    SUM(
        CASE 
            WHEN c.svi_carcasse_status IN ('SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT') THEN 
                COALESCE(c.svi_ipm2_nombre_animaux, c.nombre_d_animaux, 1)
            ELSE 
                COALESCE(c.nombre_d_animaux, 1)
        END
    ) as total_animaux
FROM "Carcasse" c
JOIN "Fei" f ON c.fei_numero = f.numero
WHERE 
    c.deleted_at IS NULL 
    AND f.svi_assigned_at IS NOT NULL
    AND c.intermediaire_carcasse_refus_intermediaire_id IS NULL
    AND (c.intermediaire_carcasse_manquante IS NULL OR c.intermediaire_carcasse_manquante = false)
    AND c.svi_carcasse_status NOT IN ('MANQUANTE', 'SANS_DECISION')
GROUP BY 
    CASE 
        WHEN c.svi_carcasse_status IN ('SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT') THEN
            CASE 
                WHEN c.svi_ipm2_lesions_ou_motifs IS NULL 
                     OR c.svi_ipm2_lesions_ou_motifs = '{}' THEN 'Aucun motif de saisie'
                ELSE array_to_string(c.svi_ipm2_lesions_ou_motifs::text[], ', ')
            END
        ELSE c.svi_carcasse_status::text
    END
ORDER BY 
    status_or_motif;

CREATE UNIQUE INDEX ON carcasse_svi_stats (status_or_motif);