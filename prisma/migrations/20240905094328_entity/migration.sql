/*
  Warnings:

  - The values [COMMERCE_DE_DETAIL,REPAS_DE_CHASSE_OU_ASSOCIATIF,CONSOMMATEUR_FINAL,BOUCHER,RESTAURATEUR] on the enum `UserRoles` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `address_ligne_1` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `address_ligne_2` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `numero_centre_collecte` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `raison_sociale` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EntityRoles" AS ENUM ('COLLECTEUR_PRO', 'EXPLOITANT_CENTRE_COLLECTE', 'ETG', 'SVI');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRoles_new" AS ENUM ('ADMIN', 'EXAMINATEUR_INITIAL', 'DETENTEUR_INITIAL', 'EXPLOITANT_CENTRE_COLLECTE', 'COLLECTEUR_PRO', 'ETG', 'SVI');
ALTER TABLE "User" ALTER COLUMN "roles" TYPE "UserRoles_new"[] USING ("roles"::text::"UserRoles_new"[]);
ALTER TABLE "SuiviFei" ALTER COLUMN "fei_user_role" TYPE "UserRoles_new" USING ("fei_user_role"::text::"UserRoles_new");
ALTER TABLE "SuiviCarcasse" ALTER COLUMN "carcasse_user_role" TYPE "UserRoles_new" USING ("carcasse_user_role"::text::"UserRoles_new");
ALTER TYPE "UserRoles" RENAME TO "UserRoles_old";
ALTER TYPE "UserRoles_new" RENAME TO "UserRoles";
DROP TYPE "UserRoles_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "address_ligne_1",
DROP COLUMN "address_ligne_2",
DROP COLUMN "numero_centre_collecte",
DROP COLUMN "raison_sociale",
ADD COLUMN     "addresse_ligne_1" TEXT,
ADD COLUMN     "addresse_ligne_2" TEXT;

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "address_ligne_1" TEXT,
    "address_ligne_2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "siret" TEXT,
    "numero_ddecpp" TEXT,
    "roles" "EntityRoles"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRelations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "EntityRelations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityRelations_owner_id_relation_idx" ON "EntityRelations"("owner_id", "relation");

-- CreateIndex
CREATE INDEX "EntityRelations_entity_id_relation_idx" ON "EntityRelations"("entity_id", "relation");

-- AddForeignKey
ALTER TABLE "EntityRelations" ADD CONSTRAINT "EntityRelations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelations" ADD CONSTRAINT "EntityRelations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
