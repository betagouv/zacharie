-- Index unique partiel sur le SIRET des commerces de détail.
--
-- Garantit au niveau base qu'un même SIRET ne peut pas être enregistré deux fois en
-- COMMERCE_DE_DETAIL actif. C'est le filet de sécurité de la déduplication par l'annuaire :
-- même en cas de course (deux chasseurs sélectionnant le même commerce au même instant),
-- une seule entité survit.
--
-- Partiel : ne s'applique qu'aux COMMERCE_DE_DETAIL non supprimés avec un SIRET renseigné
-- (les entités libres sans SIRET, ou d'autres types, ne sont pas contraintes).
--
-- Prisma ne sait pas exprimer un index partiel avec WHERE dans schema.prisma : on le crée en SQL.
-- À exécuter UNE FOIS, manuellement, APRÈS le script de déduplication
-- (20260624_dedup_commerce_detail_by_siret.sql), sinon la création échoue sur les doublons existants.

CREATE UNIQUE INDEX IF NOT EXISTS entity_siret_commerce_detail_unique
ON "Entity" (siret)
WHERE type = 'COMMERCE_DE_DETAIL' AND siret IS NOT NULL AND deleted_at IS NULL;
