-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('ADMIN', 'EXAMINATEUR_INITIAL', 'DETENTEUR_INITIAL', 'EXPLOITANT_CENTRE_COLLECTE', 'COLLECTEUR_PRO', 'ETG', 'SVI');

-- CreateEnum
CREATE TYPE "UserNotifications" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "EntityTypes" AS ENUM ('COLLECTEUR_PRO', 'EXPLOITANT_CENTRE_COLLECTE', 'ETG', 'SVI');

-- CreateEnum
CREATE TYPE "UserRelationType" AS ENUM ('DETENTEUR_INITIAL', 'EXAMINATEUR_INITIAL');

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
    "numero_frei" TEXT,
    "addresse_ligne_1" TEXT,
    "addresse_ligne_2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "roles" "UserRoles"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "notifications" "UserNotifications"[],
    "web_push_tokens" TEXT[],
    "prefilled" BOOLEAN NOT NULL DEFAULT false,

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
    "detenteur_actuel_id" TEXT,
    "numero" TEXT NOT NULL,
    "date_mise_a_mort" DATE NOT NULL,
    "commune_mise_a_mort" TEXT NOT NULL,
    "approbation_mise_sur_le_marche_examinateur_initial" BOOLEAN,
    "date_approbation_mise_sur_le_marche_examinateur_initial" TIMESTAMP(3),
    "date_depot_centre_collecte" TIMESTAMP(3),
    "date_validation_svi" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Fei_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviFei" (
    "id" TEXT NOT NULL,
    "fei_id" INTEGER NOT NULL,
    "suivi_par_user_id" TEXT NOT NULL,
    "suivi_par_user_role" "UserRoles" NOT NULL,
    "suivi_par_user_email" TEXT,
    "suivi_par_user_telephone" TEXT,
    "suivi_par_user_prenom" TEXT,
    "suivi_par_user_nom_de_famille" TEXT,
    "suivi_par_user_raison_sociale" TEXT,
    "suivi_par_user_numero_cfei" TEXT,
    "suivi_par_user_numero_centre_collecte" TEXT,
    "suivi_par_user_address_ligne_1" TEXT,
    "suivi_par_user_address_ligne_2" TEXT,
    "suivi_par_user_code_postal" TEXT,
    "suivi_par_user_ville" TEXT,
    "fei_transfered_to" TEXT,
    "fei_approbation_mise_sur_le_marche" BOOLEAN,
    "fei_commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "SuiviFei_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carcasse" (
    "id" TEXT NOT NULL,
    "fei_id" INTEGER NOT NULL,
    "numero_bracelet" TEXT NOT NULL,
    "heure_mise_a_mort" TIME NOT NULL,
    "heure_evisceration" TIME NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Carcasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviCarcasse" (
    "id" TEXT NOT NULL,
    "carcasse_id" TEXT NOT NULL,
    "suivi_carcasse_user_id" TEXT NOT NULL,
    "suivi_carcasse_user_role" "UserRoles" NOT NULL,
    "suivi_carcasse_user_email" TEXT,
    "suivi_carcasse_user_telephone" TEXT,
    "suivi_carcasse_user_prenom" TEXT,
    "suivi_carcasse_user_nom_de_famille" TEXT,
    "suivi_carcasse_user_raison_sociale" TEXT,
    "suivi_carcasse_user_numero_cfei" TEXT,
    "suivi_carcasse_user_numero_centre_collecte" TEXT,
    "suivi_carcasse_user_address_ligne_1" TEXT,
    "suivi_carcasse_user_address_ligne_2" TEXT,
    "suivi_carcasse_user_code_postal" TEXT,
    "suivi_carcasse_user_ville" TEXT,
    "suivi_carcasse_prise_en_charge" BOOLEAN,
    "suivi_carcasse_date_prise_en_charge" TIMESTAMP(3),
    "suivi_carcasse_motif_refus" TEXT,
    "suivi_carcasse_approbation_mise_sur_le_marche" BOOLEAN,
    "suivi_carcasse_sans_anomalie" BOOLEAN,
    "suivi_anomalies_carcasse" TEXT[],
    "suivi_abats_sans_anomalie" BOOLEAN,
    "suivi_anomalies_abats" TEXT[],
    "suivi_carcasse_commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "SuiviCarcasse_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_prenom_nom_de_famille_roles_idx" ON "User"("email", "prenom", "nom_de_famille", "roles");

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
CREATE INDEX "Fei_detenteur_actuel_id_numero_date_mise_a_mort_idx" ON "Fei"("detenteur_actuel_id", "numero", "date_mise_a_mort");

-- CreateIndex
CREATE INDEX "SuiviFei_fei_id_suivi_par_user_id_suivi_par_user_role_idx" ON "SuiviFei"("fei_id", "suivi_par_user_id", "suivi_par_user_role");

-- CreateIndex
CREATE UNIQUE INDEX "Carcasse_numero_bracelet_key" ON "Carcasse"("numero_bracelet");

-- CreateIndex
CREATE INDEX "Carcasse_fei_id_numero_bracelet_idx" ON "Carcasse"("fei_id", "numero_bracelet");

-- CreateIndex
CREATE INDEX "SuiviCarcasse_carcasse_id_suivi_carcasse_user_id_suivi_carc_idx" ON "SuiviCarcasse"("carcasse_id", "suivi_carcasse_user_id", "suivi_carcasse_user_role");

-- CreateIndex
CREATE INDEX "NotificationLog_user_id_action_idx" ON "NotificationLog"("user_id", "action");

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
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_detenteur_actuel_id_fkey" FOREIGN KEY ("detenteur_actuel_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviFei" ADD CONSTRAINT "SuiviFei_suivi_par_user_id_fkey" FOREIGN KEY ("suivi_par_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviFei" ADD CONSTRAINT "SuiviFei_fei_transfered_to_fkey" FOREIGN KEY ("fei_transfered_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviFei" ADD CONSTRAINT "SuiviFei_fei_id_fkey" FOREIGN KEY ("fei_id") REFERENCES "Fei"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_fei_id_fkey" FOREIGN KEY ("fei_id") REFERENCES "Fei"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviCarcasse" ADD CONSTRAINT "SuiviCarcasse_suivi_carcasse_user_id_fkey" FOREIGN KEY ("suivi_carcasse_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviCarcasse" ADD CONSTRAINT "SuiviCarcasse_carcasse_id_fkey" FOREIGN KEY ("carcasse_id") REFERENCES "Carcasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
