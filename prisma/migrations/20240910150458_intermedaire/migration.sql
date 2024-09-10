/*
  Warnings:

  - You are about to drop the column `collecteur_pro_carcasse_commentaire` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `collecteur_pro_carcasse_prise_en_charge` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `collecteur_pro_carcasse_refus_motif` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `collecteur_pro_carcasse_signed_at` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `etg_carcasse_commentaire` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `etg_carcasse_prise_en_charge` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `etg_carcasse_refus_motif` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `etg_carcasse_signed_at` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `exploitant_cc_carcasse_commentaire` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `exploitant_cc_carcasse_prise_en_charge` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `exploitant_cc_carcasse_refus_motif` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `exploitant_cc_carcasse_signed_at` on the `Carcasse` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_collecteur_pro_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_collecteur_pro_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_etg_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_etg_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_exploitant_centre_collecte_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_exploitant_centre_collecte_user_id_fkey";

-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "collecteur_pro_carcasse_commentaire",
DROP COLUMN "collecteur_pro_carcasse_prise_en_charge",
DROP COLUMN "collecteur_pro_carcasse_refus_motif",
DROP COLUMN "collecteur_pro_carcasse_signed_at",
DROP COLUMN "etg_carcasse_commentaire",
DROP COLUMN "etg_carcasse_prise_en_charge",
DROP COLUMN "etg_carcasse_refus_motif",
DROP COLUMN "etg_carcasse_signed_at",
DROP COLUMN "exploitant_cc_carcasse_commentaire",
DROP COLUMN "exploitant_cc_carcasse_prise_en_charge",
DROP COLUMN "exploitant_cc_carcasse_refus_motif",
DROP COLUMN "exploitant_cc_carcasse_signed_at",
ADD COLUMN     "intermediaire_carcasse_commentaire" TEXT,
ADD COLUMN     "intermediaire_carcasse_refus_intermediaire_id" TEXT,
ADD COLUMN     "intermediaire_carcasse_refus_motif" TEXT,
ADD COLUMN     "intermediaire_carcasse_signed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Intermediaire" (
    "id" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "intermediaire_user_id" TEXT NOT NULL,
    "intermediaire_entity_id" TEXT NOT NULL,
    "commentaire" TEXT,
    "signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Intermediaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IntermediaireCarcasse" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Intermediaire_fei_numero_intermediaire_user_id_intermediair_idx" ON "Intermediaire"("fei_numero", "intermediaire_user_id", "intermediaire_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "_IntermediaireCarcasse_AB_unique" ON "_IntermediaireCarcasse"("A", "B");

-- CreateIndex
CREATE INDEX "_IntermediaireCarcasse_B_index" ON "_IntermediaireCarcasse"("B");

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_intermediaire_carcasse_refus_intermediaire_id_fkey" FOREIGN KEY ("intermediaire_carcasse_refus_intermediaire_id") REFERENCES "Intermediaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intermediaire" ADD CONSTRAINT "Intermediaire_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intermediaire" ADD CONSTRAINT "Intermediaire_intermediaire_user_id_fkey" FOREIGN KEY ("intermediaire_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intermediaire" ADD CONSTRAINT "Intermediaire_intermediaire_entity_id_fkey" FOREIGN KEY ("intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IntermediaireCarcasse" ADD CONSTRAINT "_IntermediaireCarcasse_A_fkey" FOREIGN KEY ("A") REFERENCES "Carcasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IntermediaireCarcasse" ADD CONSTRAINT "_IntermediaireCarcasse_B_fkey" FOREIGN KEY ("B") REFERENCES "Intermediaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
