DROP MATERIALIZED VIEW IF EXISTS carcasse_intermediaire_refus_stats;
CREATE MATERIALIZED VIEW carcasse_intermediaire_refus_stats AS
SELECT
    CASE
        WHEN c.intermediaire_carcasse_manquante = TRUE THEN 'Carcasse manquante'
        WHEN c.intermediaire_carcasse_refus_motif IS NOT NULL
        AND c.intermediaire_carcasse_refus_motif != '' THEN c.intermediaire_carcasse_refus_motif
        ELSE 'Aucun problème'
    END AS STATUS,
    COUNT(*) AS count
FROM
    "Carcasse" c
    JOIN "Fei" f ON c.fei_numero = f.numero
WHERE
    c.deleted_at IS NULL
GROUP BY
    CASE
        WHEN c.intermediaire_carcasse_manquante = TRUE THEN 'Carcasse manquante'
        WHEN c.intermediaire_carcasse_refus_motif IS NOT NULL
        AND c.intermediaire_carcasse_refus_motif != '' THEN c.intermediaire_carcasse_refus_motif
        ELSE 'Aucun problème'
    END;
CREATE UNIQUE INDEX ON carcasse_intermediaire_refus_stats (STATUS);