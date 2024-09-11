/*
  Warnings:

  - You are about to drop the column `collecteur_pro_commentaire` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `collecteur_pro_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `collecteur_pro_signed_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `collecteur_pro_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `date_prise_en_charge_collecteur_pro` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `date_prise_en_charge_etg` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `date_prise_en_charge_svi` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `etg_commentaire` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `etg_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `etg_signed_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `etg_user_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `exploitant_centre_collecte_commentaire` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `exploitant_centre_collecte_entity_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `exploitant_centre_collecte_signed_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `exploitant_centre_collecte_user_id` on the `Fei` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Fei_collecteur_pro_entity_id_idx";

-- DropIndex
DROP INDEX "Fei_collecteur_pro_user_id_idx";

-- DropIndex
DROP INDEX "Fei_etg_entity_id_idx";

-- DropIndex
DROP INDEX "Fei_etg_user_id_idx";

-- DropIndex
DROP INDEX "Fei_exploitant_centre_collecte_entity_id_idx";

-- DropIndex
DROP INDEX "Fei_exploitant_centre_collecte_user_id_idx";

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "collecteur_pro_commentaire",
DROP COLUMN "collecteur_pro_entity_id",
DROP COLUMN "collecteur_pro_signed_at",
DROP COLUMN "collecteur_pro_user_id",
DROP COLUMN "date_prise_en_charge_collecteur_pro",
DROP COLUMN "date_prise_en_charge_etg",
DROP COLUMN "date_prise_en_charge_svi",
DROP COLUMN "etg_commentaire",
DROP COLUMN "etg_entity_id",
DROP COLUMN "etg_signed_at",
DROP COLUMN "etg_user_id",
DROP COLUMN "exploitant_centre_collecte_commentaire",
DROP COLUMN "exploitant_centre_collecte_entity_id",
DROP COLUMN "exploitant_centre_collecte_signed_at",
DROP COLUMN "exploitant_centre_collecte_user_id",
ADD COLUMN     "fei_prev_owner_entity_id" TEXT,
ADD COLUMN     "fei_prev_owner_role" "UserRoles",
ADD COLUMN     "fei_prev_owner_user_id" TEXT;
