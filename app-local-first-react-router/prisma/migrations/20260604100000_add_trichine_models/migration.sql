-- CreateEnum
CREATE TYPE "TrichineType" AS ENUM ('INITIAL', 'COMPLEMENTAIRE', 'CONFIRMATION');

-- CreateEnum
CREATE TYPE "TrichineStatutAnalyse" AS ENUM ('A_COMPLETER', 'EN_COURS_ANALYSES', 'ANALYSES_TERMINEES');

-- CreateEnum
CREATE TYPE "TrichineSitePrelevement" AS ENUM ('PILIER_DIAPHRAGME', 'LANGUE', 'MEMBRE_ANTERIEUR');

-- CreateEnum
CREATE TYPE "TrichineStatutLogistiqueFTP" AS ENUM ('BROUILLON', 'ENVOYEE', 'RECUE', 'TRAITEE');

-- CreateEnum
CREATE TYPE "TrichineResultatAnalyse" AS ENUM ('NEGATIF', 'DOUTEUX', 'ANALYSE_IMPOSSIBLE', 'NON_NEGATIF', 'PRESENCE_PARASITE_NON_IDENTIFIE', 'POSITIF');

-- AlterEnum
ALTER TYPE "UserRoles" ADD VALUE 'LABORATOIRE';

-- AlterEnum
ALTER TYPE "EntityTypes" ADD VALUE 'LABORATOIRE';

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "is_lnr" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "consommateur_final_email" TEXT,
ADD COLUMN     "consommateur_notifie_at" TIMESTAMP(3),
ADD COLUMN     "notifier_consommateur" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trichine_action_requise" TEXT,
ADD COLUMN     "trichine_retire_de_fei_at" TIMESTAMP(3),
ADD COLUMN     "trichine_retire_de_fei_motif" TEXT,
ADD COLUMN     "trichine_retire_de_fei_user_id" TEXT;

-- CreateTable
CREATE TABLE "TrichineEchantillon" (
    "id" TEXT NOT NULL,
    "reference_echantillon" TEXT NOT NULL,
    "zacharie_carcasse_id" TEXT NOT NULL,
    "preleve_par_user_id" TEXT NOT NULL,
    "preleve_par_entity_id" TEXT,
    "type" "TrichineType" NOT NULL,
    "site_prelevement" "TrichineSitePrelevement" NOT NULL,
    "masse_grammes" INTEGER NOT NULL,
    "date_prelevement" DATE NOT NULL,
    "statut" "TrichineStatutAnalyse" NOT NULL DEFAULT 'A_COMPLETER',
    "resultat_analyse" "TrichineResultatAnalyse",
    "pool_id" TEXT,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrichineEchantillon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrichinePool" (
    "id" TEXT NOT NULL,
    "reference_pool" TEXT NOT NULL,
    "cree_par_user_id" TEXT NOT NULL,
    "cree_par_entity_id" TEXT,
    "type" "TrichineType" NOT NULL,
    "pool_parent_id" TEXT,
    "date_constitution" DATE NOT NULL,
    "date_reception" TIMESTAMP(3),
    "date_debut_analyse" DATE,
    "date_fin_analyse" DATE,
    "statut" "TrichineStatutAnalyse" NOT NULL DEFAULT 'A_COMPLETER',
    "resultat_analyse" "TrichineResultatAnalyse",
    "parasite_identifie" TEXT,
    "reference_labo" TEXT,
    "refus_par_user_id" TEXT,
    "raison_refus" TEXT,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrichinePool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrichineFTP" (
    "id" TEXT NOT NULL,
    "numero_fiche" TEXT NOT NULL,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_envoi" TIMESTAMP(3),
    "expediteur_user_id" TEXT NOT NULL,
    "expediteur_entity_id" TEXT,
    "destinataire_entity_id" TEXT NOT NULL,
    "ftp_parent_id" TEXT,
    "statut_logistique" "TrichineStatutLogistiqueFTP" NOT NULL DEFAULT 'BROUILLON',
    "statut_analytique" "TrichineStatutAnalyse" NOT NULL DEFAULT 'A_COMPLETER',
    "mode_transport" TEXT,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrichineFTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrichinePoolFTP" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "ftp_id" TEXT NOT NULL,
    "date_ajout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrichinePoolFTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrichineDocument" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fichier_url" TEXT NOT NULL,
    "date_ajout" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ajoute_par_user_id" TEXT NOT NULL,
    "pool_id" TEXT,
    "ftp_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrichineDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrichineNotification" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objet_type" TEXT NOT NULL,
    "objet_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "date_creation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "date_lecture" TIMESTAMP(3),

    CONSTRAINT "TrichineNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrichineHistoriqueStatut" (
    "id" TEXT NOT NULL,
    "objet_type" TEXT NOT NULL,
    "objet_id" TEXT NOT NULL,
    "ancien_statut" TEXT NOT NULL,
    "nouveau_statut" TEXT NOT NULL,
    "date_changement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifie_par_user_id" TEXT NOT NULL,
    "commentaire" TEXT,

    CONSTRAINT "TrichineHistoriqueStatut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrichineEchantillon_reference_echantillon_key" ON "TrichineEchantillon"("reference_echantillon");

-- CreateIndex
CREATE INDEX "TrichineEchantillon_zacharie_carcasse_id_idx" ON "TrichineEchantillon"("zacharie_carcasse_id");

-- CreateIndex
CREATE INDEX "TrichineEchantillon_pool_id_idx" ON "TrichineEchantillon"("pool_id");

-- CreateIndex
CREATE INDEX "TrichineEchantillon_updated_at_idx" ON "TrichineEchantillon"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "TrichinePool_reference_pool_key" ON "TrichinePool"("reference_pool");

-- CreateIndex
CREATE INDEX "TrichinePool_pool_parent_id_idx" ON "TrichinePool"("pool_parent_id");

-- CreateIndex
CREATE INDEX "TrichinePool_cree_par_user_id_idx" ON "TrichinePool"("cree_par_user_id");

-- CreateIndex
CREATE INDEX "TrichinePool_cree_par_entity_id_idx" ON "TrichinePool"("cree_par_entity_id");

-- CreateIndex
CREATE INDEX "TrichinePool_updated_at_idx" ON "TrichinePool"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "TrichineFTP_numero_fiche_key" ON "TrichineFTP"("numero_fiche");

-- CreateIndex
CREATE INDEX "TrichineFTP_expediteur_user_id_idx" ON "TrichineFTP"("expediteur_user_id");

-- CreateIndex
CREATE INDEX "TrichineFTP_destinataire_entity_id_idx" ON "TrichineFTP"("destinataire_entity_id");

-- CreateIndex
CREATE INDEX "TrichineFTP_ftp_parent_id_idx" ON "TrichineFTP"("ftp_parent_id");

-- CreateIndex
CREATE INDEX "TrichineFTP_updated_at_idx" ON "TrichineFTP"("updated_at");

-- CreateIndex
CREATE INDEX "TrichinePoolFTP_ftp_id_idx" ON "TrichinePoolFTP"("ftp_id");

-- CreateIndex
CREATE UNIQUE INDEX "TrichinePoolFTP_pool_id_ftp_id_key" ON "TrichinePoolFTP"("pool_id", "ftp_id");

-- CreateIndex
CREATE INDEX "TrichineDocument_pool_id_idx" ON "TrichineDocument"("pool_id");

-- CreateIndex
CREATE INDEX "TrichineDocument_ftp_id_idx" ON "TrichineDocument"("ftp_id");

-- CreateIndex
CREATE INDEX "TrichineNotification_utilisateur_id_lu_idx" ON "TrichineNotification"("utilisateur_id", "lu");

-- CreateIndex
CREATE INDEX "TrichineNotification_objet_type_objet_id_idx" ON "TrichineNotification"("objet_type", "objet_id");

-- CreateIndex
CREATE INDEX "TrichineHistoriqueStatut_objet_type_objet_id_idx" ON "TrichineHistoriqueStatut"("objet_type", "objet_id");

-- CreateIndex
CREATE INDEX "TrichineHistoriqueStatut_modifie_par_user_id_idx" ON "TrichineHistoriqueStatut"("modifie_par_user_id");

-- CreateIndex
CREATE INDEX "Entity_type_is_lnr_idx" ON "Entity"("type", "is_lnr");

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_trichine_retire_de_fei_user_id_fkey" FOREIGN KEY ("trichine_retire_de_fei_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineEchantillon" ADD CONSTRAINT "TrichineEchantillon_zacharie_carcasse_id_fkey" FOREIGN KEY ("zacharie_carcasse_id") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineEchantillon" ADD CONSTRAINT "TrichineEchantillon_preleve_par_user_id_fkey" FOREIGN KEY ("preleve_par_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineEchantillon" ADD CONSTRAINT "TrichineEchantillon_preleve_par_entity_id_fkey" FOREIGN KEY ("preleve_par_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineEchantillon" ADD CONSTRAINT "TrichineEchantillon_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "TrichinePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichinePool" ADD CONSTRAINT "TrichinePool_cree_par_user_id_fkey" FOREIGN KEY ("cree_par_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichinePool" ADD CONSTRAINT "TrichinePool_cree_par_entity_id_fkey" FOREIGN KEY ("cree_par_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichinePool" ADD CONSTRAINT "TrichinePool_pool_parent_id_fkey" FOREIGN KEY ("pool_parent_id") REFERENCES "TrichinePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichinePool" ADD CONSTRAINT "TrichinePool_refus_par_user_id_fkey" FOREIGN KEY ("refus_par_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineFTP" ADD CONSTRAINT "TrichineFTP_expediteur_user_id_fkey" FOREIGN KEY ("expediteur_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineFTP" ADD CONSTRAINT "TrichineFTP_expediteur_entity_id_fkey" FOREIGN KEY ("expediteur_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineFTP" ADD CONSTRAINT "TrichineFTP_destinataire_entity_id_fkey" FOREIGN KEY ("destinataire_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineFTP" ADD CONSTRAINT "TrichineFTP_ftp_parent_id_fkey" FOREIGN KEY ("ftp_parent_id") REFERENCES "TrichineFTP"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichinePoolFTP" ADD CONSTRAINT "TrichinePoolFTP_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "TrichinePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichinePoolFTP" ADD CONSTRAINT "TrichinePoolFTP_ftp_id_fkey" FOREIGN KEY ("ftp_id") REFERENCES "TrichineFTP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineDocument" ADD CONSTRAINT "TrichineDocument_ajoute_par_user_id_fkey" FOREIGN KEY ("ajoute_par_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineDocument" ADD CONSTRAINT "TrichineDocument_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "TrichinePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineDocument" ADD CONSTRAINT "TrichineDocument_ftp_id_fkey" FOREIGN KEY ("ftp_id") REFERENCES "TrichineFTP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineNotification" ADD CONSTRAINT "TrichineNotification_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineHistoriqueStatut" ADD CONSTRAINT "TrichineHistoriqueStatut_modifie_par_user_id_fkey" FOREIGN KEY ("modifie_par_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

