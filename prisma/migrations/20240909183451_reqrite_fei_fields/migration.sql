/*
  Warnings:

  - You are about to drop the column `abats_sans_anomalie` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `anomalies_abats` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `anomalies_carcasse` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_approbation_mise_sur_le_marche` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_commentaire` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_date_prise_en_charge` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_motif_refus` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_prise_en_charge` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_sans_anomalie` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_address_ligne_1` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_address_ligne_2` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_code_postal` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_email` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_id` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_nom_de_famille` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_numero_centre_collecte` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_numero_cfei` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_prenom` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_raison_sociale` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_role` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_telephone` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `carcasse_user_ville` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_address_ligne_1` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_address_ligne_2` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_code_postal` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_email` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_id` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_nom_de_famille` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_numero_centre_collecte` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_numero_cfei` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_prenom` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_raison_sociale` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_role` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_telephone` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `fei_user_ville` on the `SuiviFei` table. All the data in the column will be lost.
  - Added the required column `suivi_carcasse_user_id` to the `SuiviCarcasse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `suivi_carcasse_user_role` to the `SuiviCarcasse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `suivi_par_user_id` to the `SuiviFei` table without a default value. This is not possible if the table is not empty.
  - Added the required column `suivi_par_user_role` to the `SuiviFei` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SuiviCarcasse" DROP CONSTRAINT "SuiviCarcasse_carcasse_user_id_fkey";

-- DropForeignKey
ALTER TABLE "SuiviFei" DROP CONSTRAINT "SuiviFei_fei_user_id_fkey";

-- DropIndex
DROP INDEX "SuiviCarcasse_carcasse_id_carcasse_user_id_carcasse_user_ro_idx";

-- DropIndex
DROP INDEX "SuiviFei_fei_id_fei_user_id_fei_user_role_idx";

-- AlterTable
ALTER TABLE "SuiviCarcasse" DROP COLUMN "abats_sans_anomalie",
DROP COLUMN "anomalies_abats",
DROP COLUMN "anomalies_carcasse",
DROP COLUMN "carcasse_approbation_mise_sur_le_marche",
DROP COLUMN "carcasse_commentaire",
DROP COLUMN "carcasse_date_prise_en_charge",
DROP COLUMN "carcasse_motif_refus",
DROP COLUMN "carcasse_prise_en_charge",
DROP COLUMN "carcasse_sans_anomalie",
DROP COLUMN "carcasse_user_address_ligne_1",
DROP COLUMN "carcasse_user_address_ligne_2",
DROP COLUMN "carcasse_user_code_postal",
DROP COLUMN "carcasse_user_email",
DROP COLUMN "carcasse_user_id",
DROP COLUMN "carcasse_user_nom_de_famille",
DROP COLUMN "carcasse_user_numero_centre_collecte",
DROP COLUMN "carcasse_user_numero_cfei",
DROP COLUMN "carcasse_user_prenom",
DROP COLUMN "carcasse_user_raison_sociale",
DROP COLUMN "carcasse_user_role",
DROP COLUMN "carcasse_user_telephone",
DROP COLUMN "carcasse_user_ville",
ADD COLUMN     "suivi_abats_sans_anomalie" BOOLEAN,
ADD COLUMN     "suivi_anomalies_abats" TEXT[],
ADD COLUMN     "suivi_anomalies_carcasse" TEXT[],
ADD COLUMN     "suivi_carcasse_approbation_mise_sur_le_marche" BOOLEAN,
ADD COLUMN     "suivi_carcasse_commentaire" TEXT,
ADD COLUMN     "suivi_carcasse_date_prise_en_charge" TIMESTAMP(3),
ADD COLUMN     "suivi_carcasse_motif_refus" TEXT,
ADD COLUMN     "suivi_carcasse_prise_en_charge" BOOLEAN,
ADD COLUMN     "suivi_carcasse_sans_anomalie" BOOLEAN,
ADD COLUMN     "suivi_carcasse_user_address_ligne_1" TEXT,
ADD COLUMN     "suivi_carcasse_user_address_ligne_2" TEXT,
ADD COLUMN     "suivi_carcasse_user_code_postal" TEXT,
ADD COLUMN     "suivi_carcasse_user_email" TEXT,
ADD COLUMN     "suivi_carcasse_user_id" TEXT NOT NULL,
ADD COLUMN     "suivi_carcasse_user_nom_de_famille" TEXT,
ADD COLUMN     "suivi_carcasse_user_numero_centre_collecte" TEXT,
ADD COLUMN     "suivi_carcasse_user_numero_cfei" TEXT,
ADD COLUMN     "suivi_carcasse_user_prenom" TEXT,
ADD COLUMN     "suivi_carcasse_user_raison_sociale" TEXT,
ADD COLUMN     "suivi_carcasse_user_role" "UserRoles" NOT NULL,
ADD COLUMN     "suivi_carcasse_user_telephone" TEXT,
ADD COLUMN     "suivi_carcasse_user_ville" TEXT;

-- AlterTable
ALTER TABLE "SuiviFei" DROP COLUMN "fei_user_address_ligne_1",
DROP COLUMN "fei_user_address_ligne_2",
DROP COLUMN "fei_user_code_postal",
DROP COLUMN "fei_user_email",
DROP COLUMN "fei_user_id",
DROP COLUMN "fei_user_nom_de_famille",
DROP COLUMN "fei_user_numero_centre_collecte",
DROP COLUMN "fei_user_numero_cfei",
DROP COLUMN "fei_user_prenom",
DROP COLUMN "fei_user_raison_sociale",
DROP COLUMN "fei_user_role",
DROP COLUMN "fei_user_telephone",
DROP COLUMN "fei_user_ville",
ADD COLUMN     "suivi_par_user_address_ligne_1" TEXT,
ADD COLUMN     "suivi_par_user_address_ligne_2" TEXT,
ADD COLUMN     "suivi_par_user_code_postal" TEXT,
ADD COLUMN     "suivi_par_user_email" TEXT,
ADD COLUMN     "suivi_par_user_id" TEXT NOT NULL,
ADD COLUMN     "suivi_par_user_nom_de_famille" TEXT,
ADD COLUMN     "suivi_par_user_numero_centre_collecte" TEXT,
ADD COLUMN     "suivi_par_user_numero_cfei" TEXT,
ADD COLUMN     "suivi_par_user_prenom" TEXT,
ADD COLUMN     "suivi_par_user_raison_sociale" TEXT,
ADD COLUMN     "suivi_par_user_role" "UserRoles" NOT NULL,
ADD COLUMN     "suivi_par_user_telephone" TEXT,
ADD COLUMN     "suivi_par_user_ville" TEXT;

-- CreateIndex
CREATE INDEX "SuiviCarcasse_carcasse_id_suivi_carcasse_user_id_suivi_carc_idx" ON "SuiviCarcasse"("carcasse_id", "suivi_carcasse_user_id", "suivi_carcasse_user_role");

-- CreateIndex
CREATE INDEX "SuiviFei_fei_id_suivi_par_user_id_suivi_par_user_role_idx" ON "SuiviFei"("fei_id", "suivi_par_user_id", "suivi_par_user_role");

-- AddForeignKey
ALTER TABLE "SuiviFei" ADD CONSTRAINT "SuiviFei_suivi_par_user_id_fkey" FOREIGN KEY ("suivi_par_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviCarcasse" ADD CONSTRAINT "SuiviCarcasse_suivi_carcasse_user_id_fkey" FOREIGN KEY ("suivi_carcasse_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
