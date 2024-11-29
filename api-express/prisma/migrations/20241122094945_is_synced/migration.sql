-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ETGAndEntityRelations" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EntityAndUserRelations" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FeiIntermediaire" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserRelations" ADD COLUMN     "isSynced" BOOLEAN NOT NULL DEFAULT false;
