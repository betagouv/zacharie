/*
  Warnings:

  - You are about to drop the column `approbation_mise_sur_le_marche_examinateur_initial` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `date_approbation_mise_sur_le_marche_examinateur_initial` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `date_validation_svi` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `detenteur_actuel_id` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the `SuiviCarcasse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuiviFei` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `created_by_user_id` to the `Fei` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_created_by_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_detenteur_actuel_id_fkey";

-- DropForeignKey
ALTER TABLE "SuiviCarcasse" DROP CONSTRAINT "SuiviCarcasse_carcasse_id_fkey";

-- DropForeignKey
ALTER TABLE "SuiviCarcasse" DROP CONSTRAINT "SuiviCarcasse_suivi_carcasse_user_id_fkey";

-- DropForeignKey
ALTER TABLE "SuiviFei" DROP CONSTRAINT "SuiviFei_fei_id_fkey";

-- DropForeignKey
ALTER TABLE "SuiviFei" DROP CONSTRAINT "SuiviFei_fei_transfered_to_fkey";

-- DropForeignKey
ALTER TABLE "SuiviFei" DROP CONSTRAINT "SuiviFei_suivi_par_user_id_fkey";

-- DropIndex
DROP INDEX "Fei_detenteur_actuel_id_numero_date_mise_a_mort_idx";

-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "collecteur_pro_carcasse_commentaire" TEXT,
ADD COLUMN     "collecteur_pro_carcasse_prise_en_charge" BOOLEAN,
ADD COLUMN     "collecteur_pro_carcasse_refus_motif" TEXT,
ADD COLUMN     "collecteur_pro_carcasse_signed_at" TIMESTAMP(3),
ADD COLUMN     "etg_carcasse_commentaire" TEXT,
ADD COLUMN     "etg_carcasse_prise_en_charge" BOOLEAN,
ADD COLUMN     "etg_carcasse_refus_motif" TEXT,
ADD COLUMN     "etg_carcasse_signed_at" TIMESTAMP(3),
ADD COLUMN     "examinateur_abats_sans_anomalie" BOOLEAN,
ADD COLUMN     "examinateur_anomalies_abats" TEXT[],
ADD COLUMN     "examinateur_anomalies_carcasse" TEXT[],
ADD COLUMN     "examinateur_carcasse_sans_anomalie" BOOLEAN,
ADD COLUMN     "examinateur_commentaire" TEXT,
ADD COLUMN     "examinateur_refus" BOOLEAN,
ADD COLUMN     "examinateur_signed_at" TIMESTAMP(3),
ADD COLUMN     "exploitant_cc_carcasse_commentaire" TEXT,
ADD COLUMN     "exploitant_cc_carcasse_prise_en_charge" BOOLEAN,
ADD COLUMN     "exploitant_cc_carcasse_refus_motif" TEXT,
ADD COLUMN     "exploitant_cc_carcasse_signed_at" TIMESTAMP(3),
ADD COLUMN     "svi_carcasse_commentaire" TEXT,
ADD COLUMN     "svi_carcasse_signed_at" TIMESTAMP(3),
ADD COLUMN     "svi_saisie_carcasse" BOOLEAN,
ADD COLUMN     "svi_saisie_carcasse_at" TIMESTAMP(3),
ADD COLUMN     "svi_saisie_carcasse_motif" TEXT;

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "approbation_mise_sur_le_marche_examinateur_initial",
DROP COLUMN "created_by",
DROP COLUMN "date_approbation_mise_sur_le_marche_examinateur_initial",
DROP COLUMN "date_validation_svi",
DROP COLUMN "detenteur_actuel_id",
ADD COLUMN     "collecteur_pro_commentaire" TEXT,
ADD COLUMN     "collecteur_pro_entity_id" TEXT,
ADD COLUMN     "collecteur_pro_user_id" TEXT,
ADD COLUMN     "created_by_user_id" TEXT NOT NULL,
ADD COLUMN     "date_prise_en_charge_collecteur_pro" TIMESTAMP(3),
ADD COLUMN     "date_prise_en_charge_etg" TIMESTAMP(3),
ADD COLUMN     "date_prise_en_charge_svi" TIMESTAMP(3),
ADD COLUMN     "detenteur_initial_user_id" TEXT,
ADD COLUMN     "etg_commentaire" TEXT,
ADD COLUMN     "etg_entity_id" TEXT,
ADD COLUMN     "etg_user_id" TEXT,
ADD COLUMN     "examinateur_initial_approbation_mise_sur_le_marche" BOOLEAN,
ADD COLUMN     "examinateur_initial_date_approbation_mise_sur_le_marche" TIMESTAMP(3),
ADD COLUMN     "examinateur_initial_user_id" TEXT,
ADD COLUMN     "exploitant_centre_collecte_commentaire" TEXT,
ADD COLUMN     "exploitant_centre_collecte_entity_id" TEXT,
ADD COLUMN     "exploitant_centre_collecte_user_id" TEXT,
ADD COLUMN     "svi_aucune_carcasse_saisie" BOOLEAN,
ADD COLUMN     "svi_carcasses_saisies" INTEGER,
ADD COLUMN     "svi_commentaire" TEXT,
ADD COLUMN     "svi_entity_id" TEXT,
ADD COLUMN     "svi_signed_at" TIMESTAMP(3),
ADD COLUMN     "svi_user_id" TEXT,
ALTER COLUMN "date_mise_a_mort" DROP NOT NULL,
ALTER COLUMN "commune_mise_a_mort" DROP NOT NULL;

-- DropTable
DROP TABLE "SuiviCarcasse";

-- DropTable
DROP TABLE "SuiviFei";

-- CreateIndex
CREATE INDEX "Fei_created_by_user_id_idx" ON "Fei"("created_by_user_id");

-- CreateIndex
CREATE INDEX "Fei_detenteur_initial_user_id_idx" ON "Fei"("detenteur_initial_user_id");

-- CreateIndex
CREATE INDEX "Fei_examinateur_initial_user_id_idx" ON "Fei"("examinateur_initial_user_id");

-- CreateIndex
CREATE INDEX "Fei_exploitant_centre_collecte_entity_id_idx" ON "Fei"("exploitant_centre_collecte_entity_id");

-- CreateIndex
CREATE INDEX "Fei_exploitant_centre_collecte_user_id_idx" ON "Fei"("exploitant_centre_collecte_user_id");

-- CreateIndex
CREATE INDEX "Fei_collecteur_pro_entity_id_idx" ON "Fei"("collecteur_pro_entity_id");

-- CreateIndex
CREATE INDEX "Fei_collecteur_pro_user_id_idx" ON "Fei"("collecteur_pro_user_id");

-- CreateIndex
CREATE INDEX "Fei_etg_entity_id_idx" ON "Fei"("etg_entity_id");

-- CreateIndex
CREATE INDEX "Fei_etg_user_id_idx" ON "Fei"("etg_user_id");

-- CreateIndex
CREATE INDEX "Fei_svi_entity_id_idx" ON "Fei"("svi_entity_id");

-- CreateIndex
CREATE INDEX "Fei_svi_user_id_idx" ON "Fei"("svi_user_id");

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_detenteur_initial_user_id_fkey" FOREIGN KEY ("detenteur_initial_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_examinateur_initial_user_id_fkey" FOREIGN KEY ("examinateur_initial_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_exploitant_centre_collecte_entity_id_fkey" FOREIGN KEY ("exploitant_centre_collecte_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_exploitant_centre_collecte_user_id_fkey" FOREIGN KEY ("exploitant_centre_collecte_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_collecteur_pro_entity_id_fkey" FOREIGN KEY ("collecteur_pro_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_collecteur_pro_user_id_fkey" FOREIGN KEY ("collecteur_pro_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_etg_entity_id_fkey" FOREIGN KEY ("etg_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_etg_user_id_fkey" FOREIGN KEY ("etg_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_entity_id_fkey" FOREIGN KEY ("svi_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_user_id_fkey" FOREIGN KEY ("svi_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
