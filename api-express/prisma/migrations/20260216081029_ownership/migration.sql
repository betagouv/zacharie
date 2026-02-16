/*
  Warnings:

  - You are about to drop the column `fei_current_owner_entity_id` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_entity_name_cache` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_role` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_user_id` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_current_owner_user_name_cache` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_entity_id` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_entity_name_cache` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_role` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_sous_traite_at` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_sous_traite_by_entity_id` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_sous_traite_by_user_id` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_user_id` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_user_name_cache` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_next_owner_wants_to_sous_traite` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_prev_owner_entity_id` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_prev_owner_role` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_prev_owner_user_id` on the `Carcasse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "fei_current_owner_entity_id",
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
ADD COLUMN     "current_owner_entity_id" TEXT,
ADD COLUMN     "current_owner_entity_name_cache" TEXT,
ADD COLUMN     "current_owner_role" "FeiOwnerRole",
ADD COLUMN     "current_owner_user_id" TEXT,
ADD COLUMN     "current_owner_user_name_cache" TEXT,
ADD COLUMN     "next_owner_entity_id" TEXT,
ADD COLUMN     "next_owner_entity_name_cache" TEXT,
ADD COLUMN     "next_owner_role" "FeiOwnerRole",
ADD COLUMN     "next_owner_sous_traite_at" TIMESTAMP(3),
ADD COLUMN     "next_owner_sous_traite_by_entity_id" TEXT,
ADD COLUMN     "next_owner_sous_traite_by_user_id" TEXT,
ADD COLUMN     "next_owner_user_id" TEXT,
ADD COLUMN     "next_owner_user_name_cache" TEXT,
ADD COLUMN     "next_owner_wants_to_sous_traite" BOOLEAN,
ADD COLUMN     "prev_owner_entity_id" TEXT,
ADD COLUMN     "prev_owner_role" "FeiOwnerRole",
ADD COLUMN     "prev_owner_user_id" TEXT;
