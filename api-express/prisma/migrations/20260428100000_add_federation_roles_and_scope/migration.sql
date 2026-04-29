-- AlterEnum: UserRoles — add fédérations
ALTER TYPE "UserRoles" ADD VALUE 'FDC';
ALTER TYPE "UserRoles" ADD VALUE 'FRC';
ALTER TYPE "UserRoles" ADD VALUE 'FNC';

-- AlterEnum: EntityTypes — add fédérations
ALTER TYPE "EntityTypes" ADD VALUE 'FDC';
ALTER TYPE "EntityTypes" ADD VALUE 'FRC';
ALTER TYPE "EntityTypes" ADD VALUE 'FNC';

-- AlterTable: scope géographique des fédérations
ALTER TABLE "Entity" ADD COLUMN "scope_departements_codes" TEXT[];
