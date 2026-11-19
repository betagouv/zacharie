-- AlterEnum
ALTER TYPE "UserRoles" ADD VALUE 'CIRCUIT_COURT';

-- AlterEnum
ALTER TYPE "EntityTypes" ADD VALUE 'CIRCUIT_COURT';

-- AlterEnum
ALTER TYPE "FeiOwnerRole" ADD VALUE 'CIRCUIT_COURT';

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN "qualite_du_destinataire" TEXT;

-- AlterTable
ALTER TABLE "EntityHistory" ADD COLUMN "qualite_du_destinataire" TEXT;
