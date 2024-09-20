-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('ADMIN', 'EXAMINATEUR_INITIAL', 'PREMIER_DETENTEUR', 'CCG', 'COLLECTEUR_PRO', 'ETG', 'SVI');

-- CreateEnum
CREATE TYPE "UserNotifications" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "EntityTypes" AS ENUM ('COLLECTEUR_PRO', 'CCG', 'ETG', 'SVI');

-- CreateEnum
CREATE TYPE "UserRelationType" AS ENUM ('PREMIER_DETENTEUR', 'EXAMINATEUR_INITIAL');

-- CreateEnum
CREATE TYPE "EntityRelationType" AS ENUM ('WORKING_FOR', 'WORKING_WITH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "prenom" TEXT,
    "nom_de_famille" TEXT,
    "numero_cfei" TEXT,
    "addresse_ligne_1" TEXT,
    "addresse_ligne_2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "user_entities_vivible_checkbox" BOOLEAN,
    "roles" "UserRoles"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "notifications" "UserNotifications"[] DEFAULT ARRAY['EMAIL', 'PUSH']::"UserNotifications"[],
    "web_push_tokens" TEXT[],
    "prefilled" BOOLEAN NOT NULL DEFAULT false,
    "activated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "raison_sociale" TEXT,
    "address_ligne_1" TEXT,
    "address_ligne_2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "siret" TEXT,
    "numero_ddecpp" TEXT,
    "type" "EntityTypes" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "coupled_entity_id" TEXT,
    "prefilled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Password" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Password_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRelations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "related_id" TEXT NOT NULL,
    "relation" "UserRelationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "UserRelations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityRelations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relation" "EntityRelationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "EntityRelations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fei" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "date_mise_a_mort" DATE,
    "commune_mise_a_mort" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "fei_current_owner_user_id" TEXT,
    "fei_current_owner_entity_id" TEXT,
    "fei_current_owner_role" "UserRoles",
    "fei_current_owner_wants_to_transfer" BOOLEAN,
    "fei_next_owner_user_id" TEXT,
    "fei_next_owner_entity_id" TEXT,
    "fei_next_owner_role" "UserRoles",
    "fei_prev_owner_user_id" TEXT,
    "fei_prev_owner_entity_id" TEXT,
    "fei_prev_owner_role" "UserRoles",
    "examinateur_initial_user_id" TEXT,
    "examinateur_initial_approbation_mise_sur_le_marche" BOOLEAN,
    "examinateur_initial_date_approbation_mise_sur_le_marche" TIMESTAMP(3),
    "premier_detenteur_user_id" TEXT,
    "premier_detenteur_date_depot_quelque_part" TIMESTAMP(3),
    "premier_detenteur_depot_entity_id" TEXT,
    "premier_detenteur_depot_sauvage" TEXT,
    "svi_entity_id" TEXT,
    "svi_user_id" TEXT,
    "svi_carcasses_saisies" INTEGER,
    "svi_aucune_carcasse_saisie" BOOLEAN,
    "svi_commentaire" TEXT,
    "svi_signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Fei_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carcasse" (
    "id" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "numero_bracelet" TEXT NOT NULL,
    "heure_mise_a_mort" TEXT,
    "heure_evisceration" TEXT,
    "espece" TEXT,
    "categorie" TEXT,
    "examinateur_carcasse_sans_anomalie" BOOLEAN,
    "examinateur_anomalies_carcasse" TEXT[],
    "examinateur_abats_sans_anomalie" BOOLEAN,
    "examinateur_anomalies_abats" TEXT[],
    "examinateur_commentaire" TEXT,
    "examinateur_refus" BOOLEAN,
    "examinateur_signed_at" TIMESTAMP(3),
    "intermediaire_carcasse_refus_intermediaire_id" TEXT,
    "intermediaire_carcasse_refus_motif" TEXT,
    "intermediaire_carcasse_signed_at" TIMESTAMP(3),
    "intermediaire_carcasse_commentaire" TEXT,
    "svi_carcasse_saisie" BOOLEAN,
    "svi_carcasse_saisie_motif" TEXT[],
    "svi_carcasse_saisie_at" TIMESTAMP(3),
    "svi_carcasse_signed_at" TIMESTAMP(3),
    "svi_carcasse_commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Carcasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeiIntermediaire" (
    "id" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "fei_intermediaire_user_id" TEXT NOT NULL,
    "fei_intermediaire_entity_id" TEXT NOT NULL,
    "fei_intermediaire_role" "UserRoles",
    "commentaire" TEXT,
    "received_at" TIMESTAMP(3),
    "check_finished_at" TIMESTAMP(3),
    "handover_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "FeiIntermediaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarcasseIntermediaire" (
    "id" TEXT NOT NULL,
    "fei_numero__bracelet__intermediaire_id" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "numero_bracelet" TEXT NOT NULL,
    "fei_intermediaire_id" TEXT NOT NULL,
    "fei_intermediaire_user_id" TEXT NOT NULL,
    "fei_intermediaire_entity_id" TEXT NOT NULL,
    "prise_en_charge" BOOLEAN,
    "refus" TEXT,
    "commentaire" TEXT,
    "check_finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CarcasseIntermediaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "type" "UserNotifications" NOT NULL,
    "email" TEXT,
    "web_push_token" TEXT,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FeiIntermediairesCarcasse" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_prenom_nom_de_famille_roles_idx" ON "User"("email", "prenom", "nom_de_famille", "roles");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_numero_ddecpp_key" ON "Entity"("numero_ddecpp");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_coupled_entity_id_key" ON "Entity"("coupled_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "Password_user_id_key" ON "Password"("user_id");

-- CreateIndex
CREATE INDEX "Password_user_id_idx" ON "Password"("user_id");

-- CreateIndex
CREATE INDEX "UserRelations_owner_id_relation_idx" ON "UserRelations"("owner_id", "relation");

-- CreateIndex
CREATE INDEX "EntityRelations_owner_id_relation_idx" ON "EntityRelations"("owner_id", "relation");

-- CreateIndex
CREATE INDEX "EntityRelations_entity_id_relation_idx" ON "EntityRelations"("entity_id", "relation");

-- CreateIndex
CREATE INDEX "Logs_user_id_action_idx" ON "Logs"("user_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Fei_numero_key" ON "Fei"("numero");

-- CreateIndex
CREATE INDEX "Fei_created_by_user_id_idx" ON "Fei"("created_by_user_id");

-- CreateIndex
CREATE INDEX "Fei_premier_detenteur_user_id_idx" ON "Fei"("premier_detenteur_user_id");

-- CreateIndex
CREATE INDEX "Fei_examinateur_initial_user_id_idx" ON "Fei"("examinateur_initial_user_id");

-- CreateIndex
CREATE INDEX "Fei_svi_entity_id_idx" ON "Fei"("svi_entity_id");

-- CreateIndex
CREATE INDEX "Fei_svi_user_id_idx" ON "Fei"("svi_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Carcasse_numero_bracelet_key" ON "Carcasse"("numero_bracelet");

-- CreateIndex
CREATE INDEX "Carcasse_fei_numero_numero_bracelet_idx" ON "Carcasse"("fei_numero", "numero_bracelet");

-- CreateIndex
CREATE INDEX "FeiIntermediaire_fei_numero_fei_intermediaire_user_id_fei_i_idx" ON "FeiIntermediaire"("fei_numero", "fei_intermediaire_user_id", "fei_intermediaire_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "CarcasseIntermediaire_fei_numero__bracelet__intermediaire_i_key" ON "CarcasseIntermediaire"("fei_numero__bracelet__intermediaire_id");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_fei_numero__bracelet__intermediaire_i_idx" ON "CarcasseIntermediaire"("fei_numero__bracelet__intermediaire_id");

-- CreateIndex
CREATE INDEX "NotificationLog_user_id_action_idx" ON "NotificationLog"("user_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "_FeiIntermediairesCarcasse_AB_unique" ON "_FeiIntermediairesCarcasse"("A", "B");

-- CreateIndex
CREATE INDEX "_FeiIntermediairesCarcasse_B_index" ON "_FeiIntermediairesCarcasse"("B");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_coupled_entity_id_fkey" FOREIGN KEY ("coupled_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Password" ADD CONSTRAINT "Password_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRelations" ADD CONSTRAINT "UserRelations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRelations" ADD CONSTRAINT "UserRelations_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelations" ADD CONSTRAINT "EntityRelations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityRelations" ADD CONSTRAINT "EntityRelations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_user_id_fkey" FOREIGN KEY ("premier_detenteur_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_examinateur_initial_user_id_fkey" FOREIGN KEY ("examinateur_initial_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_depot_entity_id_fkey" FOREIGN KEY ("premier_detenteur_depot_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_entity_id_fkey" FOREIGN KEY ("svi_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_user_id_fkey" FOREIGN KEY ("svi_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_current_owner_user_id_fkey" FOREIGN KEY ("fei_current_owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_current_owner_entity_id_fkey" FOREIGN KEY ("fei_current_owner_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_entity_id_fkey" FOREIGN KEY ("fei_next_owner_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_intermediaire_carcasse_refus_intermediaire_id_fkey" FOREIGN KEY ("intermediaire_carcasse_refus_intermediaire_id") REFERENCES "FeiIntermediaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_intermediaire_user_id_fkey" FOREIGN KEY ("fei_intermediaire_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_intermediaire_entity_id_fkey" FOREIGN KEY ("fei_intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey" FOREIGN KEY ("numero_bracelet") REFERENCES "Carcasse"("numero_bracelet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_user_id_fkey" FOREIGN KEY ("fei_intermediaire_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_entity_id_fkey" FOREIGN KEY ("fei_intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_id_fkey" FOREIGN KEY ("fei_intermediaire_id") REFERENCES "FeiIntermediaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" ADD CONSTRAINT "_FeiIntermediairesCarcasse_A_fkey" FOREIGN KEY ("A") REFERENCES "Carcasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" ADD CONSTRAINT "_FeiIntermediairesCarcasse_B_fkey" FOREIGN KEY ("B") REFERENCES "FeiIntermediaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
