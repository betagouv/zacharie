/*
  Warnings:

  - You are about to drop the column `isSynced` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `isSynced` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `isSynced` on the `ETGAndEntityRelations` table. All the data in the column will be lost.
  - You are about to drop the column `isSynced` on the `Entity` table. All the data in the column will be lost.
  - You are about to drop the column `isSynced` on the `EntityAndUserRelations` table. All the data in the column will be lost.
  - You are about to drop the column `isSynced` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_depot_sauvage` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `isSynced` on the `FeiIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `isSynced` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isSynced` on the `UserRelations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "isSynced",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP COLUMN "isSynced",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ETGAndEntityRelations" DROP COLUMN "isSynced",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "isSynced",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EntityAndUserRelations" DROP COLUMN "isSynced",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "isSynced",
DROP COLUMN "premier_detenteur_depot_sauvage",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FeiIntermediaire" DROP COLUMN "isSynced",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isSynced",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserRelations" DROP COLUMN "isSynced",
ADD COLUMN     "is_synced" BOOLEAN NOT NULL DEFAULT false;
