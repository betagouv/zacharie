/*
  Warnings:

  - You are about to drop the column `carcasse_check_finished_at` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `fei_intermediaire_entity_id` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `fei_intermediaire_id` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `fei_intermediaire_user_id` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `fei_numero__bracelet__intermediaire_id` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the `FeiIntermediaire` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP COLUMN "carcasse_check_finished_at",
DROP COLUMN "fei_intermediaire_entity_id",
DROP COLUMN "fei_intermediaire_id",
DROP COLUMN "fei_intermediaire_user_id",
DROP COLUMN "fei_numero__bracelet__intermediaire_id";

-- DropTable
DROP TABLE "FeiIntermediaire";
