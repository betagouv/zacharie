-- CreateEnum
CREATE TYPE "StatsRefCircuit" AS ENUM ('LONG', 'COURT');

-- CreateEnum
CREATE TYPE "StatsRefIndicateur" AS ENUM ('VOLUME_GLOBAL', 'OBJECTIF_PART_TRACEE', 'TAUX_SAISIE', 'TAUX_SAISIE_BPH_HORS_ZACHARIE');

-- CreateTable
CREATE TABLE "stats_ref_national" (
    "id" TEXT NOT NULL,
    "saison" TEXT NOT NULL,
    "circuit" "StatsRefCircuit" NOT NULL,
    "type_gibier" "CarcasseType" NOT NULL,
    "indicateur" "StatsRefIndicateur" NOT NULL,
    "valeur" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stats_ref_national_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats_ref_ofb_tableau_chasse" (
    "saison" TEXT NOT NULL,
    "departement" TEXT NOT NULL,
    "espece" TEXT NOT NULL,
    "nombre" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stats_ref_ofb_tableau_chasse_pkey" PRIMARY KEY ("saison","departement","espece")
);

-- CreateIndex
CREATE UNIQUE INDEX "stats_ref_national_saison_circuit_type_gibier_indicateur_key" ON "stats_ref_national"("saison", "circuit", "type_gibier", "indicateur");
