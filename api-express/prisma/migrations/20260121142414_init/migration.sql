-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('ADMIN', 'CHASSEUR', 'COLLECTEUR_PRO', 'ETG', 'SVI', 'COMMERCE_DE_DETAIL', 'CANTINE_OU_RESTAURATION_COLLECTIVE', 'ASSOCIATION_CARITATIVE', 'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CONSOMMATEUR_FINAL');

-- CreateEnum
CREATE TYPE "UserEtgRoles" AS ENUM ('TRANSPORT', 'RECEPTION');

-- CreateEnum
CREATE TYPE "UserNotifications" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "EntityTypes" AS ENUM ('PREMIER_DETENTEUR', 'COLLECTEUR_PRO', 'CCG', 'ETG', 'SVI', 'COMMERCE_DE_DETAIL', 'CANTINE_OU_RESTAURATION_COLLECTIVE', 'ASSOCIATION_CARITATIVE', 'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CONSOMMATEUR_FINAL');

-- CreateEnum
CREATE TYPE "UserRelationType" AS ENUM ('PREMIER_DETENTEUR', 'EXAMINATEUR_INITIAL');

-- CreateEnum
CREATE TYPE "EntityRelationType" AS ENUM ('CAN_TRANSMIT_CARCASSES_TO_ENTITY', 'CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY', 'WORKING_FOR_ENTITY_RELATED_WITH', 'NONE');

-- CreateEnum
CREATE TYPE "EntityRelationStatus" AS ENUM ('REQUESTED', 'MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DepotType" AS ENUM ('CCG', 'ETG', 'AUCUN');

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('PREMIER_DETENTEUR', 'ETG', 'COLLECTEUR_PRO', 'AUCUN');

-- CreateEnum
CREATE TYPE "FeiOwnerRole" AS ENUM ('EXAMINATEUR_INITIAL', 'PREMIER_DETENTEUR', 'ETG', 'COLLECTEUR_PRO', 'SVI', 'COMMERCE_DE_DETAIL', 'CANTINE_OU_RESTAURATION_COLLECTIVE', 'ASSOCIATION_CARITATIVE', 'REPAS_DE_CHASSE_OU_ASSOCIATIF', 'CONSOMMATEUR_FINAL');

-- CreateEnum
CREATE TYPE "CarcasseType" AS ENUM ('PETIT_GIBIER', 'GROS_GIBIER');

-- CreateEnum
CREATE TYPE "CarcasseStatus" AS ENUM ('MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'SANS_DECISION', 'ACCEPTE', 'CONSIGNE', 'MANQUANTE_SVI', 'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'LEVEE_DE_CONSIGNE', 'TRAITEMENT_ASSAINISSANT');

-- CreateEnum
CREATE TYPE "IPM1Protocole" AS ENUM ('STANDARD', 'RENFORCE');

-- CreateEnum
CREATE TYPE "IPM1Decision" AS ENUM ('NON_RENSEIGNEE', 'MISE_EN_CONSIGNE', 'ACCEPTE');

-- CreateEnum
CREATE TYPE "IPM2Decision" AS ENUM ('NON_RENSEIGNEE', 'LEVEE_DE_LA_CONSIGNE', 'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT');

-- CreateEnum
CREATE TYPE "IPM2Traitement" AS ENUM ('CUISSON', 'CONGELATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "PoidsType" AS ENUM ('NON_DEPOUILLE', 'DEPOUILLE', 'NON_PLUMEE', 'PLUMEE');

-- CreateEnum
CREATE TYPE "CarcasseCertificatType" AS ENUM ('CC', 'CSP', 'CST', 'LC', 'LPS');

-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('FEI_READ_FOR_USER', 'FEI_READ_FOR_ENTITY', 'CARCASSE_READ_FOR_USER', 'CARCASSE_READ_FOR_ENTITY');

-- CreateEnum
CREATE TYPE "ApiKeyApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApiKeyLogAction" AS ENUM ('CREATED', 'USED', 'WEBHOOK_SENT', 'REVOKED', 'EXPIRED', 'UPDATED', 'RATE_LIMITED', 'INVALID_SCOPE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "prenom" TEXT,
    "nom_de_famille" TEXT,
    "numero_cfei" TEXT,
    "est_forme_a_l_examen_initial" BOOLEAN,
    "prochain_bracelet_a_utiliser" INTEGER DEFAULT 1,
    "addresse_ligne_1" TEXT,
    "addresse_ligne_2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "user_entities_vivible_checkbox" BOOLEAN,
    "roles" "UserRoles"[],
    "etg_role" "UserEtgRoles" NOT NULL DEFAULT 'RECEPTION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "notifications" "UserNotifications"[] DEFAULT ARRAY['EMAIL', 'PUSH']::"UserNotifications"[],
    "web_push_tokens" TEXT[],
    "native_push_tokens" TEXT[],
    "prefilled" BOOLEAN NOT NULL DEFAULT false,
    "activated" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,
    "brevo_contact_id" INTEGER,
    "at_least_one_fei_treated" TIMESTAMP(3),
    "checked_has_asso_de_chasse" TIMESTAMP(3),
    "checked_has_ccg" TIMESTAMP(3),
    "checked_has_partenaires" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "raison_sociale" TEXT,
    "nom_d_usage" TEXT,
    "address_ligne_1" TEXT,
    "address_ligne_2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "siret" TEXT,
    "nom_prenom_responsable" TEXT,
    "prefecture_svi" TEXT,
    "ccg_status" TEXT,
    "etg_linked_to_svi_id" TEXT,
    "zacharie_compatible" BOOLEAN NOT NULL DEFAULT false,
    "numero_ddecpp" TEXT,
    "inc_certificat" INTEGER DEFAULT 0,
    "inc_decision" INTEGER DEFAULT 0,
    "code_etbt_certificat" TEXT,
    "type" "EntityTypes" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "prefilled" BOOLEAN NOT NULL DEFAULT false,
    "is_synced" BOOLEAN NOT NULL DEFAULT true,
    "for_testing" BOOLEAN NOT NULL DEFAULT false,
    "brevo_id" TEXT,
    "at_least_one_fei_treated" TIMESTAMP(3),

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Password" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "reset_password_last_email_sent_at" TIMESTAMP(3),
    "reset_password_token" TEXT,
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
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserRelations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityAndUserRelations" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "relation" "EntityRelationType" NOT NULL,
    "status" "EntityRelationStatus" NOT NULL DEFAULT 'REQUESTED',
    "brevo_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EntityAndUserRelations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_role" TEXT,
    "fei_numero" TEXT,
    "entity_id" TEXT,
    "zacharie_carcasse_id" TEXT,
    "fei_intermediaire_id" TEXT,
    "intermediaire_id" TEXT,
    "carcasse_intermediaire_id" TEXT,
    "action" TEXT NOT NULL,
    "history" JSONB,
    "date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fei" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "date_mise_a_mort" DATE,
    "commune_mise_a_mort" TEXT,
    "heure_mise_a_mort_premiere_carcasse" TEXT,
    "heure_evisceration_derniere_carcasse" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "creation_context" TEXT DEFAULT 'zacharie',
    "resume_nombre_de_carcasses" TEXT,
    "automatic_closed_at" TIMESTAMP(3),
    "examinateur_initial_offline" BOOLEAN,
    "examinateur_initial_user_id" TEXT,
    "examinateur_initial_approbation_mise_sur_le_marche" BOOLEAN,
    "examinateur_initial_date_approbation_mise_sur_le_marche" TIMESTAMP(3),
    "premier_detenteur_offline" BOOLEAN,
    "premier_detenteur_user_id" TEXT,
    "premier_detenteur_entity_id" TEXT,
    "premier_detenteur_name_cache" TEXT,
    "premier_detenteur_depot_type" "DepotType",
    "premier_detenteur_depot_entity_id" TEXT,
    "premier_detenteur_depot_entity_name_cache" TEXT,
    "premier_detenteur_depot_ccg_at" TIMESTAMP(3),
    "premier_detenteur_transport_type" "TransportType",
    "premier_detenteur_transport_date" TIMESTAMP(3),
    "premier_detenteur_prochain_detenteur_role_cache" "FeiOwnerRole",
    "premier_detenteur_prochain_detenteur_id_cache" TEXT,
    "intermediaire_closed_at" TIMESTAMP(3),
    "intermediaire_closed_by_user_id" TEXT,
    "intermediaire_closed_by_entity_id" TEXT,
    "latest_intermediaire_user_id" TEXT,
    "latest_intermediaire_entity_id" TEXT,
    "latest_intermediaire_name_cache" TEXT,
    "svi_assigned_at" TIMESTAMP(3),
    "svi_entity_id" TEXT,
    "svi_user_id" TEXT,
    "svi_closed_at" TIMESTAMP(3),
    "svi_closed_by_user_id" TEXT,
    "fei_current_owner_user_id" TEXT,
    "fei_current_owner_user_name_cache" TEXT,
    "fei_current_owner_entity_id" TEXT,
    "fei_current_owner_entity_name_cache" TEXT,
    "fei_current_owner_role" "FeiOwnerRole",
    "fei_next_owner_wants_to_sous_traite" BOOLEAN,
    "fei_next_owner_sous_traite_at" TIMESTAMP(3),
    "fei_next_owner_sous_traite_by_user_id" TEXT,
    "fei_next_owner_sous_traite_by_entity_id" TEXT,
    "fei_next_owner_user_id" TEXT,
    "fei_next_owner_user_name_cache" TEXT,
    "fei_next_owner_entity_id" TEXT,
    "fei_next_owner_entity_name_cache" TEXT,
    "fei_next_owner_role" "FeiOwnerRole",
    "fei_prev_owner_user_id" TEXT,
    "fei_prev_owner_entity_id" TEXT,
    "fei_prev_owner_role" "FeiOwnerRole",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Fei_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carcasse" (
    "zacharie_carcasse_id" TEXT NOT NULL,
    "numero_bracelet" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "date_mise_a_mort" DATE,
    "espece" TEXT,
    "type" "CarcasseType",
    "nombre_d_animaux" INTEGER,
    "heure_mise_a_mort" TEXT,
    "heure_evisceration" TEXT,
    "examinateur_carcasse_sans_anomalie" BOOLEAN,
    "examinateur_anomalies_carcasse" TEXT[],
    "examinateur_anomalies_abats" TEXT[],
    "examinateur_commentaire" TEXT,
    "examinateur_signed_at" TIMESTAMP(3),
    "premier_detenteur_depot_type" "DepotType",
    "premier_detenteur_depot_entity_id" TEXT,
    "premier_detenteur_depot_entity_name_cache" TEXT,
    "premier_detenteur_depot_ccg_at" TIMESTAMP(3),
    "premier_detenteur_transport_type" "TransportType",
    "premier_detenteur_transport_date" TIMESTAMP(3),
    "premier_detenteur_prochain_detenteur_role_cache" "FeiOwnerRole",
    "premier_detenteur_prochain_detenteur_id_cache" TEXT,
    "intermediaire_carcasse_refus_intermediaire_id" TEXT,
    "intermediaire_carcasse_refus_motif" TEXT,
    "intermediaire_carcasse_manquante" BOOLEAN,
    "latest_intermediaire_signed_at" TIMESTAMP(3),
    "svi_assigned_to_fei_at" TIMESTAMP(3),
    "svi_carcasse_commentaire" TEXT,
    "svi_carcasse_status" "CarcasseStatus",
    "svi_carcasse_status_set_at" TIMESTAMP(3),
    "svi_ipm1_date" TIMESTAMP(3),
    "svi_ipm1_presentee_inspection" BOOLEAN,
    "svi_ipm1_user_id" TEXT,
    "svi_ipm1_user_name_cache" TEXT,
    "svi_ipm1_protocole" "IPM1Protocole",
    "svi_ipm1_pieces" TEXT[],
    "svi_ipm1_lesions_ou_motifs" TEXT[],
    "svi_ipm1_nombre_animaux" INTEGER,
    "svi_ipm1_commentaire" TEXT,
    "svi_ipm1_decision" "IPM1Decision",
    "svi_ipm1_duree_consigne" INTEGER,
    "svi_ipm1_poids_consigne" DOUBLE PRECISION,
    "svi_ipm1_poids_type" "PoidsType",
    "svi_ipm1_signed_at" TIMESTAMP(3),
    "svi_ipm2_date" TIMESTAMP(3),
    "svi_ipm2_presentee_inspection" BOOLEAN,
    "svi_ipm2_user_id" TEXT,
    "svi_ipm2_user_name_cache" TEXT,
    "svi_ipm2_protocole" "IPM1Protocole",
    "svi_ipm2_pieces" TEXT[],
    "svi_ipm2_lesions_ou_motifs" TEXT[],
    "svi_ipm2_nombre_animaux" INTEGER,
    "svi_ipm2_commentaire" TEXT,
    "svi_ipm2_decision" "IPM2Decision",
    "svi_ipm2_traitement_assainissant" "IPM2Traitement"[],
    "svi_ipm2_traitement_assainissant_cuisson_temps" TEXT,
    "svi_ipm2_traitement_assainissant_cuisson_temp" TEXT,
    "svi_ipm2_traitement_assainissant_congelation_temps" TEXT,
    "svi_ipm2_traitement_assainissant_congelation_temp" TEXT,
    "svi_ipm2_traitement_assainissant_type" TEXT,
    "svi_ipm2_traitement_assainissant_paramètres" TEXT,
    "svi_ipm2_traitement_assainissant_etablissement" TEXT,
    "svi_ipm2_traitement_assainissant_poids" DOUBLE PRECISION,
    "svi_ipm2_poids_saisie" DOUBLE PRECISION,
    "svi_ipm2_poids_type" "PoidsType",
    "svi_ipm2_signed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Carcasse_pkey" PRIMARY KEY ("zacharie_carcasse_id")
);

-- CreateTable
CREATE TABLE "CarcasseCertificat" (
    "certificat_id" TEXT NOT NULL,
    "zacharie_carcasse_id" TEXT NOT NULL,
    "remplace_certificat_id" TEXT,
    "numero_decision" TEXT,
    "numero_decision_ipm1" TEXT,
    "type" "CarcasseCertificatType",
    "prefecture_svi" TEXT,
    "commune_etg" TEXT,
    "date_consigne" TEXT,
    "lieu_consigne" TEXT,
    "nom_etg_personne_physique" TEXT,
    "nom_etg_personne_morale" TEXT,
    "siret_etg" TEXT,
    "traitement_assainissant_etablissement" TEXT,
    "traitement_type" TEXT,
    "traitement_parametre" TEXT,
    "fei_numero" TEXT,
    "numero_bracelet" TEXT,
    "espece" TEXT,
    "carcasse_type" "CarcasseType",
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
    "svi_ipm1_signed_at" TIMESTAMP(3),
    "svi_ipm2_signed_at" TIMESTAMP(3),
    "duree_consigne" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarcasseCertificat_pkey" PRIMARY KEY ("certificat_id")
);

-- CreateTable
CREATE TABLE "CarcasseIntermediaire" (
    "fei_numero" TEXT NOT NULL,
    "numero_bracelet" TEXT NOT NULL,
    "zacharie_carcasse_id" TEXT NOT NULL,
    "prise_en_charge" BOOLEAN,
    "check_manuel" BOOLEAN,
    "manquante" BOOLEAN,
    "refus" TEXT,
    "ecarte_pour_inspection" BOOLEAN,
    "commentaire" TEXT,
    "intermediaire_poids" DOUBLE PRECISION,
    "nombre_d_animaux_acceptes" INTEGER,
    "decision_at" TIMESTAMP(3),
    "prise_en_charge_at" TIMESTAMP(3),
    "intermediaire_id" TEXT NOT NULL,
    "intermediaire_entity_id" TEXT NOT NULL,
    "intermediaire_role" "FeiOwnerRole",
    "intermediaire_user_id" TEXT NOT NULL,
    "intermediaire_depot_type" "DepotType",
    "intermediaire_depot_entity_id" TEXT,
    "intermediaire_prochain_detenteur_role_cache" "FeiOwnerRole",
    "intermediaire_prochain_detenteur_id_cache" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "type" "UserNotifications" NOT NULL,
    "email" TEXT,
    "web_push_token" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronJob" (
    "id" TEXT NOT NULL,
    "unique_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "dedicated_to_entity_id" TEXT,
    "name" TEXT NOT NULL,
    "slug_for_context" TEXT,
    "description" TEXT,
    "webhook_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "access_token" TEXT,
    "access_token_read_at" TIMESTAMP(3),
    "scopes" "ApiKeyScope"[],
    "rate_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyApprovalByUserOrEntity" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_id" TEXT,
    "status" "ApiKeyApprovalStatus" NOT NULL,
    "access_token" TEXT,
    "access_token_created_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyApprovalByUserOrEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKeyLog" (
    "id" TEXT NOT NULL,
    "api_key_id" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_id" TEXT,
    "action" "ApiKeyLogAction" NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "endpoint" TEXT,
    "status_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "User"("id");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_onboarded_at_idx" ON "User"("onboarded_at");

-- CreateIndex
CREATE INDEX "User_roles_idx" ON "User"("roles");

-- CreateIndex
CREATE INDEX "User_updated_at_idx" ON "User"("updated_at");

-- CreateIndex
CREATE INDEX "User_last_seen_at_idx" ON "User"("last_seen_at");

-- CreateIndex
CREATE INDEX "User_roles_updated_at_idx" ON "User"("roles", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_numero_ddecpp_key" ON "Entity"("numero_ddecpp");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_code_etbt_certificat_key" ON "Entity"("code_etbt_certificat");

-- CreateIndex
CREATE INDEX "Entity_updated_at_idx" ON "Entity"("updated_at");

-- CreateIndex
CREATE INDEX "Entity_nom_d_usage_idx" ON "Entity"("nom_d_usage");

-- CreateIndex
CREATE INDEX "Entity_type_zacharie_compatible_nom_d_usage_idx" ON "Entity"("type", "zacharie_compatible", "nom_d_usage");

-- CreateIndex
CREATE INDEX "Entity_for_testing_updated_at_idx" ON "Entity"("for_testing", "updated_at");

-- CreateIndex
CREATE INDEX "Entity_type_updated_at_idx" ON "Entity"("type", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "Password_user_id_key" ON "Password"("user_id");

-- CreateIndex
CREATE INDEX "Password_user_id_idx" ON "Password"("user_id");

-- CreateIndex
CREATE INDEX "UserRelations_owner_id_relation_idx" ON "UserRelations"("owner_id", "relation");

-- CreateIndex
CREATE INDEX "EntityAndUserRelations_owner_id_relation_idx" ON "EntityAndUserRelations"("owner_id", "relation");

-- CreateIndex
CREATE INDEX "EntityAndUserRelations_entity_id_relation_idx" ON "EntityAndUserRelations"("entity_id", "relation");

-- CreateIndex
CREATE INDEX "EntityAndUserRelations_owner_id_entity_id_idx" ON "EntityAndUserRelations"("owner_id", "entity_id");

-- CreateIndex
CREATE INDEX "EntityAndUserRelations_owner_id_updated_at_idx" ON "EntityAndUserRelations"("owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "Log_user_id_action_idx" ON "Log"("user_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Fei_numero_key" ON "Fei"("numero");

-- CreateIndex
CREATE INDEX "Fei_created_by_user_id_idx" ON "Fei"("created_by_user_id");

-- CreateIndex
CREATE INDEX "Fei_premier_detenteur_user_id_idx" ON "Fei"("premier_detenteur_user_id");

-- CreateIndex
CREATE INDEX "Fei_examinateur_initial_user_id_idx" ON "Fei"("examinateur_initial_user_id");

-- CreateIndex
CREATE INDEX "Fei_svi_closed_at_idx" ON "Fei"("svi_closed_at");

-- CreateIndex
CREATE INDEX "Fei_fei_next_owner_user_id_idx" ON "Fei"("fei_next_owner_user_id");

-- CreateIndex
CREATE INDEX "Fei_fei_next_owner_entity_id_idx" ON "Fei"("fei_next_owner_entity_id");

-- CreateIndex
CREATE INDEX "Fei_fei_current_owner_user_id_idx" ON "Fei"("fei_current_owner_user_id");

-- CreateIndex
CREATE INDEX "Fei_fei_current_owner_entity_id_idx" ON "Fei"("fei_current_owner_entity_id");

-- CreateIndex
CREATE INDEX "Fei_updated_at_idx" ON "Fei"("updated_at");

-- CreateIndex
CREATE INDEX "Fei_svi_assigned_at_idx" ON "Fei"("svi_assigned_at");

-- CreateIndex
CREATE INDEX "Fei_svi_entity_id_svi_assigned_at_idx" ON "Fei"("svi_entity_id", "svi_assigned_at");

-- CreateIndex
CREATE INDEX "Fei_automatic_closed_at_svi_closed_at_svi_assigned_at_idx" ON "Fei"("automatic_closed_at", "svi_closed_at", "svi_assigned_at");

-- CreateIndex
CREATE INDEX "Fei_deleted_at_created_at_idx" ON "Fei"("deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "Carcasse_fei_numero_numero_bracelet_idx" ON "Carcasse"("fei_numero", "numero_bracelet");

-- CreateIndex
CREATE INDEX "Carcasse_deleted_at_date_mise_a_mort_numero_bracelet_idx" ON "Carcasse"("deleted_at", "date_mise_a_mort", "numero_bracelet" DESC);

-- CreateIndex
CREATE INDEX "Carcasse_deleted_at_created_at_idx" ON "Carcasse"("deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "Carcasse_numero_bracelet_idx" ON "Carcasse"("numero_bracelet");

-- CreateIndex
CREATE INDEX "Carcasse_deleted_at_updated_at_idx" ON "Carcasse"("deleted_at", "updated_at");

-- CreateIndex
CREATE INDEX "Carcasse_intermediaire_carcasse_refus_intermediaire_id_idx" ON "Carcasse"("intermediaire_carcasse_refus_intermediaire_id");

-- CreateIndex
CREATE INDEX "Carcasse_intermediaire_carcasse_manquante_idx" ON "Carcasse"("intermediaire_carcasse_manquante");

-- CreateIndex
CREATE INDEX "CarcasseCertificat_zacharie_carcasse_id_idx" ON "CarcasseCertificat"("zacharie_carcasse_id");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_commentaire_idx" ON "CarcasseIntermediaire"("commentaire");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_created_at_idx" ON "CarcasseIntermediaire"("created_at");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_intermediaire_entity_id_idx" ON "CarcasseIntermediaire"("intermediaire_entity_id");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_intermediaire_user_id_idx" ON "CarcasseIntermediaire"("intermediaire_user_id");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_fei_numero_prise_en_charge_at_created_idx" ON "CarcasseIntermediaire"("fei_numero", "prise_en_charge_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "CarcasseIntermediaire_fei_numero_zacharie_carcasse_id_inter_key" ON "CarcasseIntermediaire"("fei_numero", "zacharie_carcasse_id", "intermediaire_id");

-- CreateIndex
CREATE INDEX "NotificationLog_user_id_action_idx" ON "NotificationLog"("user_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "CronJob_unique_key_key" ON "CronJob"("unique_key");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_private_key_key" ON "ApiKey"("private_key");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_public_key_key" ON "ApiKey"("public_key");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_access_token_key" ON "ApiKey"("access_token");

-- CreateIndex
CREATE INDEX "ApiKey_active_expires_at_idx" ON "ApiKey"("active", "expires_at");

-- CreateIndex
CREATE INDEX "ApiKey_last_used_at_idx" ON "ApiKey"("last_used_at");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyApprovalByUserOrEntity_access_token_key" ON "ApiKeyApprovalByUserOrEntity"("access_token");

-- CreateIndex
CREATE INDEX "ApiKeyApprovalByUserOrEntity_api_key_id_status_idx" ON "ApiKeyApprovalByUserOrEntity"("api_key_id", "status");

-- CreateIndex
CREATE INDEX "ApiKeyApprovalByUserOrEntity_user_id_status_idx" ON "ApiKeyApprovalByUserOrEntity"("user_id", "status");

-- CreateIndex
CREATE INDEX "ApiKeyApprovalByUserOrEntity_entity_id_status_idx" ON "ApiKeyApprovalByUserOrEntity"("entity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyApprovalByUserOrEntity_api_key_id_entity_id_key" ON "ApiKeyApprovalByUserOrEntity"("api_key_id", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeyApprovalByUserOrEntity_api_key_id_user_id_key" ON "ApiKeyApprovalByUserOrEntity"("api_key_id", "user_id");

-- CreateIndex
CREATE INDEX "ApiKeyLog_api_key_id_created_at_idx" ON "ApiKeyLog"("api_key_id", "created_at");

-- CreateIndex
CREATE INDEX "ApiKeyLog_user_id_created_at_idx" ON "ApiKeyLog"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_etg_linked_to_svi_id_fkey" FOREIGN KEY ("etg_linked_to_svi_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Password" ADD CONSTRAINT "Password_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRelations" ADD CONSTRAINT "UserRelations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRelations" ADD CONSTRAINT "UserRelations_related_id_fkey" FOREIGN KEY ("related_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAndUserRelations" ADD CONSTRAINT "EntityAndUserRelations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAndUserRelations" ADD CONSTRAINT "EntityAndUserRelations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_user_id_fkey" FOREIGN KEY ("premier_detenteur_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_entity_id_fkey" FOREIGN KEY ("premier_detenteur_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_examinateur_initial_user_id_fkey" FOREIGN KEY ("examinateur_initial_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_depot_entity_id_fkey" FOREIGN KEY ("premier_detenteur_depot_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_entity_id_fkey" FOREIGN KEY ("svi_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_user_id_fkey" FOREIGN KEY ("svi_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_closed_by_user_id_fkey" FOREIGN KEY ("svi_closed_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_current_owner_user_id_fkey" FOREIGN KEY ("fei_current_owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_current_owner_entity_id_fkey" FOREIGN KEY ("fei_current_owner_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_entity_id_fkey" FOREIGN KEY ("fei_next_owner_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_sous_traite_by_entity_id_fkey" FOREIGN KEY ("fei_next_owner_sous_traite_by_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_user_id_fkey" FOREIGN KEY ("fei_next_owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_sous_traite_by_user_id_fkey" FOREIGN KEY ("fei_next_owner_sous_traite_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_svi_ipm1_user_id_fkey" FOREIGN KEY ("svi_ipm1_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseCertificat" ADD CONSTRAINT "CarcasseCertificat_zacharie_carcasse_id_fkey" FOREIGN KEY ("zacharie_carcasse_id") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_zacharie_carcasse_id_fkey" FOREIGN KEY ("zacharie_carcasse_id") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_intermediaire_user_id_fkey" FOREIGN KEY ("intermediaire_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_intermediaire_entity_id_fkey" FOREIGN KEY ("intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_dedicated_to_entity_id_fkey" FOREIGN KEY ("dedicated_to_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyApprovalByUserOrEntity" ADD CONSTRAINT "ApiKeyApprovalByUserOrEntity_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyApprovalByUserOrEntity" ADD CONSTRAINT "ApiKeyApprovalByUserOrEntity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyApprovalByUserOrEntity" ADD CONSTRAINT "ApiKeyApprovalByUserOrEntity_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyLog" ADD CONSTRAINT "ApiKeyLog_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyLog" ADD CONSTRAINT "ApiKeyLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyLog" ADD CONSTRAINT "ApiKeyLog_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
