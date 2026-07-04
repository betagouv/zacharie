/*
  Warnings:

  - You are about to drop the column `automatic_closed_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_entity_name_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_role` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_user_name_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_entity_name_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_role` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_sous_traite_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_sous_traite_by_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_sous_traite_by_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_user_name_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_wants_to_sous_traite` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_prev_owner_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_prev_owner_role` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_prev_owner_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `intermediaire_closed_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `intermediaire_closed_by_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `intermediaire_closed_by_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `latest_intermediaire_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `latest_intermediaire_name_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `latest_intermediaire_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_depot_ccg_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_depot_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_depot_entity_name_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_depot_type` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_prochain_detenteur_id_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_prochain_detenteur_role_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_transport_date` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_transport_type` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_assigned_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_closed_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_closed_by_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_user_id` on the `Fei` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_current_owner_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_current_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_next_owner_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_next_owner_sous_traite_by_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_next_owner_sous_traite_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_next_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_premier_detenteur_depot_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_svi_closed_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_svi_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_svi_user_id_fkey";

-- DropIndex
DROP INDEX "Fei_automatic_closed_at_svi_closed_at_svi_assigned_at_idx";

-- DropIndex
DROP INDEX "Fei_fei_current_owner_entity_id_idx";

-- DropIndex
DROP INDEX "Fei_fei_current_owner_user_id_idx";

-- DropIndex
DROP INDEX "Fei_fei_next_owner_entity_id_idx";

-- DropIndex
DROP INDEX "Fei_fei_next_owner_user_id_idx";

-- DropIndex
DROP INDEX "Fei_svi_assigned_at_idx";

-- DropIndex
DROP INDEX "Fei_svi_closed_at_idx";

-- DropIndex
DROP INDEX "Fei_svi_entity_id_svi_assigned_at_idx";

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "automatic_closed_at",
DROP COLUMN "fei_current_owner_entity_id",
DROP COLUMN "fei_current_owner_entity_name_cache",
DROP COLUMN "fei_current_owner_role",
DROP COLUMN "fei_current_owner_user_id",
DROP COLUMN "fei_current_owner_user_name_cache",
DROP COLUMN "fei_next_owner_entity_id",
DROP COLUMN "fei_next_owner_entity_name_cache",
DROP COLUMN "fei_next_owner_role",
DROP COLUMN "fei_next_owner_sous_traite_at",
DROP COLUMN "fei_next_owner_sous_traite_by_entity_id",
DROP COLUMN "fei_next_owner_sous_traite_by_user_id",
DROP COLUMN "fei_next_owner_user_id",
DROP COLUMN "fei_next_owner_user_name_cache",
DROP COLUMN "fei_next_owner_wants_to_sous_traite",
DROP COLUMN "fei_prev_owner_entity_id",
DROP COLUMN "fei_prev_owner_role",
DROP COLUMN "fei_prev_owner_user_id",
DROP COLUMN "intermediaire_closed_at",
DROP COLUMN "intermediaire_closed_by_entity_id",
DROP COLUMN "intermediaire_closed_by_user_id",
DROP COLUMN "latest_intermediaire_entity_id",
DROP COLUMN "latest_intermediaire_name_cache",
DROP COLUMN "latest_intermediaire_user_id",
DROP COLUMN "premier_detenteur_depot_ccg_at",
DROP COLUMN "premier_detenteur_depot_entity_id",
DROP COLUMN "premier_detenteur_depot_entity_name_cache",
DROP COLUMN "premier_detenteur_depot_type",
DROP COLUMN "premier_detenteur_prochain_detenteur_id_cache",
DROP COLUMN "premier_detenteur_prochain_detenteur_role_cache",
DROP COLUMN "premier_detenteur_transport_date",
DROP COLUMN "premier_detenteur_transport_type",
DROP COLUMN "svi_assigned_at",
DROP COLUMN "svi_closed_at",
DROP COLUMN "svi_closed_by_user_id",
DROP COLUMN "svi_entity_id",
DROP COLUMN "svi_user_id";
