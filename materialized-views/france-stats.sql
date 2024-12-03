CREATE INDEX ON department_statistics (department_number);

CREATE MATERIALIZED VIEW department_statistics AS
WITH department_data AS (
  SELECT 
    SUBSTRING(commune_mise_a_mort FROM 1 FOR 2) AS department_number
  FROM "Fei"
  WHERE commune_mise_a_mort IS NOT NULL
    AND deleted_at IS NULL
  GROUP BY SUBSTRING(commune_mise_a_mort FROM 1 FOR 2)
)
SELECT 
  d.department_number,
  -- FEI counts
  COUNT(DISTINCT f.id) as total_fei,
  COUNT(DISTINCT c.zacharie_carcasse_id) as total_carcasses,  -- Added line for total carcasses

  -- Especes counts
  COUNT(DISTINCT CASE WHEN c.espece = 'Cerf élaphe' THEN c.zacharie_carcasse_id END) as cerf_elaphe_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Cerf sika' THEN c.zacharie_carcasse_id END) as cerf_sika_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Chevreuil' THEN c.zacharie_carcasse_id END) as chevreuil_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Daim' THEN c.zacharie_carcasse_id END) as daim_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Sanglier' THEN c.zacharie_carcasse_id END) as sanglier_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Chamois' THEN c.zacharie_carcasse_id END) as chamois_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Isard' THEN c.zacharie_carcasse_id END) as isard_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Mouflon méditerranéen' THEN c.zacharie_carcasse_id END) as mouflon_mediterraneen_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Cailles' THEN c.zacharie_carcasse_id END) as cailles_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Canards' THEN c.zacharie_carcasse_id END) as canards_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Oies' THEN c.zacharie_carcasse_id END) as oies_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Faisans de chasse' THEN c.zacharie_carcasse_id END) as faisans_de_chasse_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Perdrix' THEN c.zacharie_carcasse_id END) as perdrix_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Pigeons' THEN c.zacharie_carcasse_id END) as pigeons_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Autres oiseaux' THEN c.zacharie_carcasse_id END) as autres_oiseaux_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Lapins' THEN c.zacharie_carcasse_id END) as lapins_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Lièvres' THEN c.zacharie_carcasse_id END) as lieves_count,
  COUNT(DISTINCT CASE WHEN c.espece = 'Autres petits gibiers à poils' THEN c.zacharie_carcasse_id END) as autres_petits_gibiers_a_poils_count,
  
  -- User role counts
  COUNT(DISTINCT CASE WHEN 'EXAMINATEUR_INITIAL' = ANY(u.roles) THEN u.id END) as examinateur_initial_count,
  COUNT(DISTINCT CASE WHEN 'PREMIER_DETENTEUR' = ANY(u.roles) THEN u.id END) as premier_detenteur_count,
  COUNT(DISTINCT CASE WHEN 'CCG' = ANY(u.roles) THEN u.id END) as ccg_count,
  COUNT(DISTINCT CASE WHEN 'COLLECTEUR_PRO' = ANY(u.roles) THEN u.id END) as collecteur_pro_count,
  COUNT(DISTINCT CASE WHEN 'ETG' = ANY(u.roles) THEN u.id END) as etg_count,
  COUNT(DISTINCT CASE WHEN 'SVI' = ANY(u.roles) THEN u.id END) as svi_count,
  
  -- Entity type counts
  COUNT(DISTINCT CASE WHEN e.type = 'PREMIER_DETENTEUR' THEN e.id END) as premier_detenteur_entity_count,
  COUNT(DISTINCT CASE WHEN e.type = 'COLLECTEUR_PRO' THEN e.id END) as collecteur_pro_entity_count,
  COUNT(DISTINCT CASE WHEN e.type = 'CCG' THEN e.id END) as ccg_entity_count,
  COUNT(DISTINCT CASE WHEN e.type = 'ETG' THEN e.id END) as etg_entity_count,
  COUNT(DISTINCT CASE WHEN e.type = 'SVI' THEN e.id END) as svi_entity_count,
  
  -- Total counts
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT e.id) as total_entities

FROM department_data d
LEFT JOIN "Fei" f ON SUBSTRING(f.commune_mise_a_mort FROM 1 FOR 2) = d.department_number
LEFT JOIN "Carcasse" c ON c.fei_numero = f.numero
LEFT JOIN "User" u ON u.id = f.created_by_user_id 
  OR u.id = f.premier_detenteur_user_id 
  OR u.id = f.examinateur_initial_user_id
  OR u.id = f.svi_user_id
LEFT JOIN "Entity" e ON e.id = f.premier_detenteur_entity_id 
  OR e.id = f.premier_detenteur_depot_entity_id
  OR e.id = f.svi_entity_id
WHERE f.deleted_at IS NULL 
  AND c.deleted_at IS NULL

GROUP BY d.department_number
ORDER BY d.department_number;

-- Create a refresh function
CREATE OR REPLACE FUNCTION refresh_department_statistics()
RETURNS TRIGGER AS
$$
BEGIN
    REFRESH MATERIALIZED VIEW department_statistics;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh the materialized view
CREATE TRIGGER refresh_department_statistics_fei
AFTER INSERT OR UPDATE OR DELETE ON "Fei"
EXECUTE FUNCTION refresh_department_statistics();

CREATE TRIGGER refresh_department_statistics_user
AFTER INSERT OR UPDATE OR DELETE ON "User"
EXECUTE FUNCTION refresh_department_statistics();

CREATE TRIGGER refresh_department_statistics_entity
AFTER INSERT OR UPDATE OR DELETE ON "Entity"
EXECUTE FUNCTION refresh_department_statistics();

CREATE TRIGGER refresh_department_statistics_carcasse
AFTER INSERT OR UPDATE OR DELETE ON "Carcasse"
EXECUTE FUNCTION refresh_department_statistics();

CREATE INDEX ON department_statistics (department_number);