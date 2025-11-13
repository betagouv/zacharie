-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityTypes" ADD VALUE 'COMMERCE_DE_DETAIL';
ALTER TYPE "EntityTypes" ADD VALUE 'REPAS_DE_CHASSE_OU_ASSOCIATIF';
ALTER TYPE "EntityTypes" ADD VALUE 'CONSOMMATEUR_FINAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRoles" ADD VALUE 'COMMERCE_DE_DETAIL';
ALTER TYPE "UserRoles" ADD VALUE 'REPAS_DE_CHASSE_OU_ASSOCIATIF';
ALTER TYPE "UserRoles" ADD VALUE 'CONSOMMATEUR_FINAL';
