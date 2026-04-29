-- AlterEnum: UserRoles — add fédérations
ALTER TYPE "UserRoles" ADD VALUE 'FDC';
ALTER TYPE "UserRoles" ADD VALUE 'FRC';
ALTER TYPE "UserRoles" ADD VALUE 'FNC';

-- AlterTable: scope géographique sur User pour les rôles FDC/FRC/FNC
ALTER TABLE "User" ADD COLUMN "scope_departements_codes" TEXT[];
