-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityTypes" ADD VALUE 'CANTINE_OU_RESTAURATION_COLLECTIVE';
ALTER TYPE "EntityTypes" ADD VALUE 'ASSOCIATION_CARITATIVE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FeiOwnerRole" ADD VALUE 'CANTINE_OU_RESTAURATION_COLLECTIVE';
ALTER TYPE "FeiOwnerRole" ADD VALUE 'ASSOCIATION_CARITATIVE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRoles" ADD VALUE 'CANTINE_OU_RESTAURATION_COLLECTIVE';
ALTER TYPE "UserRoles" ADD VALUE 'ASSOCIATION_CARITATIVE';
