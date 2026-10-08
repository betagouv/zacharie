-- Exclut des statistiques (vues Metabase de materialized-views/clean-views.sql) les comptes et
-- entités de test ou de démo connus. La liste se complète ensuite depuis l'admin
-- (case « Exclure des statistiques » sur les pages user et entité).
-- À lancer après la migration 20261008120000_exclude_from_stats.

BEGIN;

UPDATE "User"
SET exclude_from_stats = TRUE
WHERE id IN ('GLOPG', 'GLOPB', 'AMBRO', 'DEVOR', 'COLLI');

UPDATE "Entity"
SET exclude_from_stats = TRUE
WHERE id IN (
  '12b99c13-a958-4f00-8699-56bff112deaf',
  '17eb3164-3a9b-4086-9f65-7affd02b4ca4',
  'd70c55e4-a1c9-42d7-867e-16440b6c4203',
  '57c2c9bc-1d4a-4098-8f81-014200966233',
  'b2e64f3f-873d-404a-8260-73eb9ab0a2a1',
  'afedac4f-aded-48de-8acb-370e28623096',
  '22b0d069-2cb7-496b-bead-b1a2481db31e',
  '87f511d0-89cf-4ed4-8ce5-0d58a2177aab',
  'd207597a-5526-4fcf-989d-dc3f70fbc2eb'
);

-- Contrôle : 5 users et 9 entités attendus.
SELECT 'User' AS table_name, COUNT(*) FROM "User" WHERE exclude_from_stats
UNION ALL
SELECT 'Entity', COUNT(*) FROM "Entity" WHERE exclude_from_stats;

COMMIT;
