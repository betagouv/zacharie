-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('ADMIN', 'EXAMINATEUR_INITIAL', 'DETENTEUR_INITIAL', 'EXPLOITANT_CENTRE_COLLECTE', 'COLLECTEUR_PRO', 'COMMERCE_DE_DETAIL', 'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CONSOMMATEUR_FINAL', 'BOUCHER', 'RESTAURATEUR', 'ETG', 'SVI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "prenom" TEXT,
    "nom_de_famille" TEXT,
    "raison_sociale" TEXT,
    "numero_cfei" TEXT,
    "numero_frei" TEXT,
    "numero_centre_collecte" TEXT,
    "address_ligne_1" TEXT,
    "address_ligne_2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "roles" "UserRoles"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
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
    "relation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "UserRelations_pkey" PRIMARY KEY ("id")
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
    "fei_user_id" TEXT NOT NULL,
    "fei_user_role" "UserRoles" NOT NULL,
    "fei_user_email" TEXT,
    "fei_user_telephone" TEXT,
    "fei_user_prenom" TEXT,
    "fei_user_nom_de_famille" TEXT,
    "fei_user_raison_sociale" TEXT,
    "fei_user_numero_cfei" TEXT,
    "fei_user_numero_centre_collecte" TEXT,
    "fei_user_address_ligne_1" TEXT,
    "fei_user_address_ligne_2" TEXT,
    "fei_user_code_postal" TEXT,
    "fei_user_ville" TEXT,
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
    "carcasse_user_id" TEXT NOT NULL,
    "carcasse_user_role" "UserRoles" NOT NULL,
    "carcasse_user_email" TEXT,
    "carcasse_user_telephone" TEXT,
    "carcasse_user_prenom" TEXT,
    "carcasse_user_nom_de_famille" TEXT,
    "carcasse_user_raison_sociale" TEXT,
    "carcasse_user_numero_cfei" TEXT,
    "carcasse_user_numero_centre_collecte" TEXT,
    "carcasse_user_address_ligne_1" TEXT,
    "carcasse_user_address_ligne_2" TEXT,
    "carcasse_user_code_postal" TEXT,
    "carcasse_user_ville" TEXT,
    "carcasse_prise_en_charge" BOOLEAN,
    "carcasse_date_prise_en_charge" TIMESTAMP(3),
    "carcasse_motif_refus" TEXT,
    "carcasse_approbation_mise_sur_le_marche" BOOLEAN,
    "carcasse_sans_anomalie" BOOLEAN,
    "anomalies_carcasse" TEXT[],
    "abats_sans_anomalie" BOOLEAN,
    "anomalies_abats" TEXT[],
    "carcasse_commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "SuiviCarcasse_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Logs_user_id_action_idx" ON "Logs"("user_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Fei_numero_key" ON "Fei"("numero");

-- CreateIndex
CREATE INDEX "Fei_detenteur_actuel_id_numero_date_mise_a_mort_idx" ON "Fei"("detenteur_actuel_id", "numero", "date_mise_a_mort");

-- CreateIndex
CREATE INDEX "SuiviFei_fei_id_fei_user_id_fei_user_role_idx" ON "SuiviFei"("fei_id", "fei_user_id", "fei_user_role");

-- CreateIndex
CREATE UNIQUE INDEX "Carcasse_numero_bracelet_key" ON "Carcasse"("numero_bracelet");

-- CreateIndex
CREATE INDEX "Carcasse_fei_id_numero_bracelet_idx" ON "Carcasse"("fei_id", "numero_bracelet");

-- CreateIndex
CREATE INDEX "SuiviCarcasse_carcasse_id_carcasse_user_id_carcasse_user_ro_idx" ON "SuiviCarcasse"("carcasse_id", "carcasse_user_id", "carcasse_user_role");

-- AddForeignKey
ALTER TABLE "Password" ADD CONSTRAINT "Password_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRelations" ADD CONSTRAINT "UserRelations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRelations" ADD CONSTRAINT "UserRelations_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_detenteur_actuel_id_fkey" FOREIGN KEY ("detenteur_actuel_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviFei" ADD CONSTRAINT "SuiviFei_fei_user_id_fkey" FOREIGN KEY ("fei_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviFei" ADD CONSTRAINT "SuiviFei_fei_transfered_to_fkey" FOREIGN KEY ("fei_transfered_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviFei" ADD CONSTRAINT "SuiviFei_fei_id_fkey" FOREIGN KEY ("fei_id") REFERENCES "Fei"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_fei_id_fkey" FOREIGN KEY ("fei_id") REFERENCES "Fei"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviCarcasse" ADD CONSTRAINT "SuiviCarcasse_carcasse_user_id_fkey" FOREIGN KEY ("carcasse_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviCarcasse" ADD CONSTRAINT "SuiviCarcasse_carcasse_id_fkey" FOREIGN KEY ("carcasse_id") REFERENCES "Carcasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
