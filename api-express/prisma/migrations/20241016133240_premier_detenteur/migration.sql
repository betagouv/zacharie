/*
  Warnings:

  - The values [ASSOCIATION_DE_CHASSE] on the enum `EntityTypes` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EntityTypes_new" AS ENUM ('PREMIER_DETENTEUR', 'COLLECTEUR_PRO', 'CCG', 'ETG', 'SVI');
ALTER TABLE "Entity" ALTER COLUMN "type" TYPE "EntityTypes_new" USING ("type"::text::"EntityTypes_new");
ALTER TYPE "EntityTypes" RENAME TO "EntityTypes_old";
ALTER TYPE "EntityTypes_new" RENAME TO "EntityTypes";
DROP TYPE "EntityTypes_old";
COMMIT;
