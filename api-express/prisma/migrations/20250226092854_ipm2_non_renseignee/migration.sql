/*
  Warnings:

  - A unique constraint covering the columns `[inc_certificat]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code_etbt_certificat]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CarcasseCertificatType" AS ENUM ('CC', 'CSP', 'CST', 'LC', 'LPS');

-- AlterEnum
ALTER TYPE "IPM2Decision" ADD VALUE 'NON_RENSEIGNEE';

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "code_etbt_certificat" TEXT,
ADD COLUMN     "inc_certificat" TEXT;

-- CreateTable
CREATE TABLE "CarcasseCertificat" (
    "certificat_id" TEXT NOT NULL,
    "zacharie_carcasse_id" TEXT NOT NULL,
    "remplace_certificat_id" TEXT,
    "numero_decision" TEXT,
    "type" "CarcasseCertificatType",
    "departement_svi" TEXT,
    "commune_etg" TEXT,
    "date_consigne" TEXT,
    "lieu_consigne" TEXT,
    "nom_etg_personne_physique" TEXT,
    "nom_etg_personne_morale" TEXT,
    "fei_numero" TEXT,
    "numero_bracelet" TEXT,
    "espece" TEXT,
    "nombre_d_animaux" INTEGER,
    "date_mise_a_mort" TEXT,
    "commune_mise_a_mort" TEXT,
    "examinateur_initial" TEXT,
    "premier_detenteur" TEXT,
    "collecteur_pro" TEXT,
    "pieces" TEXT[],
    "motifs" TEXT[],
    "commentaire" TEXT,
    "poids" DOUBLE PRECISION,
    "duree_consigne" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarcasseCertificat_pkey" PRIMARY KEY ("certificat_id")
);

-- CreateIndex
CREATE INDEX "CarcasseCertificat_zacharie_carcasse_id_idx" ON "CarcasseCertificat"("zacharie_carcasse_id");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_inc_certificat_key" ON "Entity"("inc_certificat");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_code_etbt_certificat_key" ON "Entity"("code_etbt_certificat");

-- AddForeignKey
ALTER TABLE "CarcasseCertificat" ADD CONSTRAINT "CarcasseCertificat_zacharie_carcasse_id_fkey" FOREIGN KEY ("zacharie_carcasse_id") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE CASCADE ON UPDATE CASCADE;
