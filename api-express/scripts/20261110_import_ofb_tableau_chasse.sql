-- Import des tableaux de chasse OFB par département dans stats_ref_ofb_tableau_chasse (lue par Metabase,
-- carte du KPI 7 de materialized-views/kpi-references.sql).
--
-- Entrée : un CSV avec en-tête `saison,departement,espece,nombre`, passé sur le stdin de psql :
--   psql "$POSTGRESQL_ADDON_URI" -f api-express/scripts/20261110_import_ofb_tableau_chasse.sql < ofb.csv
--
-- `saison` au format « 2025-2026 ». `departement` : code INSEE (« 1 » ou « 01 », « 2A », « 971 ») ;
-- les codes numériques d'un seul chiffre sont complétés sur 2 caractères.
--
-- Rejouable : une ligne déjà présente (même saison, département, espèce) voit son nombre remplacé.

BEGIN;

CREATE TEMP TABLE ofb_import (
    saison TEXT NOT NULL,
    departement TEXT NOT NULL,
    espece TEXT NOT NULL,
    nombre INTEGER NOT NULL
) ON COMMIT DROP;

-- `pstdin` lit le stdin de psql même quand le script est passé avec -f
\copy ofb_import FROM pstdin WITH (FORMAT csv, HEADER)

-- Agrégé avant l'upsert : « 1 » et « 01 » deviennent la même clé et ne peuvent pas être upsertés deux fois
INSERT INTO stats_ref_ofb_tableau_chasse (saison, departement, espece, nombre, updated_at)
SELECT saison, departement, espece, sum(nombre), now()
FROM (
    SELECT
        trim(saison) AS saison,
        CASE
            WHEN trim(departement) ~ '^\d$' THEN '0' || trim(departement)
            ELSE upper(trim(departement))
        END AS departement,
        trim(espece) AS espece,
        nombre
    FROM ofb_import
) normalise
GROUP BY saison, departement, espece
ON CONFLICT (saison, departement, espece) DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = now();

-- Contrôle : lignes et total par saison
SELECT saison, count(*) AS nb_lignes, sum(nombre) AS total
FROM stats_ref_ofb_tableau_chasse
GROUP BY saison
ORDER BY saison;

COMMIT;
