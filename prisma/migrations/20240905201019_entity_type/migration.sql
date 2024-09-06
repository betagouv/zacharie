/*
  Warnings:

  - You are about to drop the column `roles` on the `Entity` table. All the data in the column will be lost.
  - Added the required column `type` to the `Entity` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EntityTypes" AS ENUM ('COLLECTEUR_PRO', 'EXPLOITANT_CENTRE_COLLECTE', 'ETG', 'SVI');

-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "roles",
ADD COLUMN     "type" "EntityTypes" NOT NULL;

-- DropEnum
DROP TYPE "EntityRoles";
