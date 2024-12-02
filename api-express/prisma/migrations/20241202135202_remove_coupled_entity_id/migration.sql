/*
  Warnings:

  - You are about to drop the column `coupled_entity_id` on the `Entity` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Entity" DROP CONSTRAINT "Entity_coupled_entity_id_fkey";

-- DropIndex
DROP INDEX "Entity_coupled_entity_id_key";

-- AlterTable
ALTER TABLE "Carcasse" ALTER COLUMN "is_synced" SET DEFAULT true;

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ALTER COLUMN "is_synced" SET DEFAULT true;

-- AlterTable
ALTER TABLE "ETGAndEntityRelations" ALTER COLUMN "is_synced" SET DEFAULT true;

-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "coupled_entity_id",
ALTER COLUMN "is_synced" SET DEFAULT true;

-- AlterTable
ALTER TABLE "EntityAndUserRelations" ALTER COLUMN "is_synced" SET DEFAULT true;

-- AlterTable
ALTER TABLE "Fei" ALTER COLUMN "is_synced" SET DEFAULT true;

-- AlterTable
ALTER TABLE "FeiIntermediaire" ALTER COLUMN "is_synced" SET DEFAULT true;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "is_synced" SET DEFAULT true;

-- AlterTable
ALTER TABLE "UserRelations" ALTER COLUMN "is_synced" SET DEFAULT true;
