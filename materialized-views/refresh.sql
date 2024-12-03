-- Drop and recreate indexes for each materialized view
DROP INDEX IF EXISTS carcasses_funnel_stats_stage_idx;
CREATE UNIQUE INDEX carcasses_funnel_stats_stage_idx ON carcasses_funnel_stats (stage);

DROP INDEX IF EXISTS fei_stats_fei_numero_idx;
CREATE UNIQUE INDEX fei_stats_fei_numero_idx ON fei_stats(fei_numero);

DROP INDEX IF EXISTS carcasse_intermediaire_refus_stats_status_idx;
CREATE UNIQUE INDEX carcasse_intermediaire_refus_stats_status_idx ON carcasse_intermediaire_refus_stats (status);

DROP INDEX IF EXISTS carcasse_svi_stats_svi_carcasse_saisie_motif_idx;
CREATE UNIQUE INDEX carcasse_svi_stats_svi_carcasse_saisie_motif_idx ON carcasse_svi_stats (svi_carcasse_saisie_motif);

-- Refresh each materialized view
REFRESH MATERIALIZED VIEW carcasses_funnel_stats;
REFRESH MATERIALIZED VIEW fei_stats;
REFRESH MATERIALIZED VIEW carcasse_intermediaire_refus_stats;
REFRESH MATERIALIZED VIEW carcasse_svi_stats;