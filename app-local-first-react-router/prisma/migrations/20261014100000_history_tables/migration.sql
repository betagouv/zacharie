-- CreateTable
CREATE TABLE "FeiHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" INTEGER,
    "numero" TEXT,
    "date_mise_a_mort" DATE,
    "commune_mise_a_mort" TEXT,
    "heure_mise_a_mort_premiere_carcasse" TEXT,
    "heure_evisceration_derniere_carcasse" TEXT,
    "created_by_user_id" TEXT,
    "creation_context" TEXT,
    "examinateur_initial_offline" BOOLEAN,
    "examinateur_initial_user_id" TEXT,
    "examinateur_initial_approbation_mise_sur_le_marche" BOOLEAN,
    "examinateur_initial_date_approbation_mise_sur_le_marche" TIMESTAMP(3),
    "consommateur_final_usage_domestique" TIMESTAMP(3),
    "premier_detenteur_offline" BOOLEAN,
    "premier_detenteur_user_id" TEXT,
    "premier_detenteur_entity_id" TEXT,
    "premier_detenteur_name_cache" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "version" INTEGER,
    "version_user_id" TEXT,
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "FeiHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "CarcasseHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "zacharie_carcasse_id" TEXT,
    "numero_bracelet" TEXT,
    "fei_numero" TEXT,
    "date_mise_a_mort" DATE,
    "espece" TEXT,
    "type" "CarcasseType",
    "nombre_d_animaux" INTEGER,
    "heure_mise_a_mort" TEXT,
    "heure_evisceration" TEXT,
    "heure_mise_a_mort_premiere_carcasse_fei" TEXT,
    "heure_evisceration_derniere_carcasse_fei" TEXT,
    "consommateur_final_usage_domestique" TIMESTAMP(3),
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
    "svi_ipm2_traitement_assainissant_etablissement" TEXT,
    "svi_ipm2_traitement_assainissant_poids" DOUBLE PRECISION,
    "svi_ipm2_poids_saisie" DOUBLE PRECISION,
    "svi_ipm2_poids_type" "PoidsType",
    "svi_ipm2_signed_at" TIMESTAMP(3),
    "trichine_action_requise" TEXT,
    "consommateur_final_email" TEXT,
    "notifier_consommateur" BOOLEAN,
    "consommateur_notifie_at" TIMESTAMP(3),
    "trichine_retire_de_fei_at" TIMESTAMP(3),
    "trichine_retire_de_fei_motif" TEXT,
    "trichine_retire_de_fei_user_id" TEXT,
    "created_by_user_id" TEXT,
    "examinateur_initial_offline" BOOLEAN,
    "examinateur_initial_user_id" TEXT,
    "examinateur_initial_approbation_mise_sur_le_marche" BOOLEAN,
    "examinateur_initial_date_approbation_mise_sur_le_marche" TIMESTAMP(3),
    "premier_detenteur_offline" BOOLEAN,
    "premier_detenteur_user_id" TEXT,
    "premier_detenteur_entity_id" TEXT,
    "premier_detenteur_name_cache" TEXT,
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
    "svi_automatic_closed_at" TIMESTAMP(3),
    "svi_closed_by_user_id" TEXT,
    "current_owner_user_id" TEXT,
    "current_owner_user_name_cache" TEXT,
    "current_owner_entity_id" TEXT,
    "current_owner_entity_name_cache" TEXT,
    "current_owner_role" "FeiOwnerRole",
    "next_owner_wants_to_sous_traite" BOOLEAN,
    "next_owner_sous_traite_at" TIMESTAMP(3),
    "next_owner_sous_traite_by_user_id" TEXT,
    "next_owner_sous_traite_by_entity_id" TEXT,
    "next_owner_user_id" TEXT,
    "next_owner_user_name_cache" TEXT,
    "next_owner_entity_id" TEXT,
    "next_owner_entity_name_cache" TEXT,
    "next_owner_role" "FeiOwnerRole",
    "prev_owner_user_id" TEXT,
    "prev_owner_entity_id" TEXT,
    "prev_owner_role" "FeiOwnerRole",
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "version" INTEGER,
    "version_user_id" TEXT,
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "CarcasseHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "CarcasseIntermediaireHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "fei_numero" TEXT,
    "numero_bracelet" TEXT,
    "zacharie_carcasse_id" TEXT,
    "prise_en_charge" BOOLEAN,
    "check_manuel" BOOLEAN,
    "manquante" BOOLEAN,
    "refus" TEXT,
    "ecarte_pour_inspection" BOOLEAN,
    "commentaire" TEXT,
    "intermediaire_poids" DOUBLE PRECISION,
    "nombre_d_animaux_acceptes" INTEGER,
    "numero_bon_reception" TEXT,
    "decision_at" TIMESTAMP(3),
    "prise_en_charge_at" TIMESTAMP(3),
    "intermediaire_id" TEXT,
    "intermediaire_entity_id" TEXT,
    "intermediaire_role" "FeiOwnerRole",
    "intermediaire_user_id" TEXT,
    "intermediaire_depot_type" "DepotType",
    "intermediaire_depot_entity_id" TEXT,
    "intermediaire_prochain_detenteur_role_cache" "FeiOwnerRole",
    "intermediaire_prochain_detenteur_id_cache" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "version" INTEGER,
    "version_user_id" TEXT,
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "CarcasseIntermediaireHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "UserHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "prenom" TEXT,
    "nom_de_famille" TEXT,
    "numero_cfei" TEXT,
    "est_forme_a_l_examen_initial" BOOLEAN,
    "prochain_bracelet_a_utiliser" INTEGER,
    "addresse_ligne_1" TEXT,
    "addresse_ligne_2" TEXT,
    "code_postal" TEXT,
    "ville" TEXT,
    "user_entities_vivible_checkbox" BOOLEAN,
    "roles" "UserRoles"[],
    "role" "UserRoles",
    "isZacharieAdmin" BOOLEAN,
    "exclude_from_stats" BOOLEAN,
    "etg_role" "UserEtgRoles",
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "notifications" "UserNotifications"[],
    "web_push_tokens" TEXT[],
    "native_push_tokens" TEXT[],
    "prefilled" BOOLEAN,
    "activated" BOOLEAN,
    "activated_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "brevo_contact_id" INTEGER,
    "at_least_one_fei_treated" TIMESTAMP(3),
    "checked_has_asso_de_chasse" TIMESTAMP(3),
    "checked_has_ccg" TIMESTAMP(3),
    "checked_has_partenaires" TIMESTAMP(3),
    "onboarding_chasse_info_done_at" TIMESTAMP(3),
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "UserHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "EntityHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
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
    "etg_demande_numero_bon_reception" BOOLEAN,
    "zacharie_compatible" BOOLEAN,
    "numero_ddecpp" TEXT,
    "inc_certificat" INTEGER,
    "inc_decision" INTEGER,
    "code_etbt_certificat" TEXT,
    "type" "EntityTypes",
    "is_lnr" BOOLEAN,
    "scope_departements_codes" TEXT[],
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "prefilled" BOOLEAN,
    "is_synced" BOOLEAN,
    "for_testing" BOOLEAN,
    "exclude_from_stats" BOOLEAN,
    "brevo_id" TEXT,
    "at_least_one_fei_treated" TIMESTAMP(3),
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "EntityHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "EntityAndUserRelationsHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
    "owner_id" TEXT,
    "entity_id" TEXT,
    "relation" "EntityRelationType",
    "status" "EntityRelationStatus",
    "brevo_id" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "EntityAndUserRelationsHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateIndex
CREATE INDEX "FeiHistory_numero_idx" ON "FeiHistory"("numero");

-- CreateIndex
CREATE INDEX "CarcasseHistory_zacharie_carcasse_id_idx" ON "CarcasseHistory"("zacharie_carcasse_id");

-- CreateIndex
CREATE INDEX "CarcasseIntermediaireHistory_fei_numero_zacharie_carcasse_i_idx" ON "CarcasseIntermediaireHistory"("fei_numero", "zacharie_carcasse_id", "intermediaire_id");

-- CreateIndex
CREATE INDEX "UserHistory_id_idx" ON "UserHistory"("id");

-- CreateIndex
CREATE INDEX "EntityHistory_id_idx" ON "EntityHistory"("id");

-- CreateIndex
CREATE INDEX "EntityAndUserRelationsHistory_id_idx" ON "EntityAndUserRelationsHistory"("id");


-- Historique des tables critiques : avant chaque UPDATE / DELETE, la version précédente de la ligne est copiée
-- dans "<Table>History", avec sys_period = période pendant laquelle elle était la ligne courante.
-- La ligne courante reste dans la table elle-même.
-- - UPDATE sans vrai changement (seuls updated_at / is_synced / version bougent) : rien n'est écrit.
-- - Copie par nom de colonne (jsonb_populate_record) : une colonne absente de l'historique est ignorée
--   au lieu de faire échouer l'écriture métier. Seules les colonnes identifiantes sont référencées par OLD.<colonne>.
-- - Début de période = fin de la version précédente, sinon created_at de la ligne (UTC, écrit par Prisma).
-- - Une fonction par table (SQL statique, plan mis en cache) : deux fois plus rapide qu'une fonction générique
--   en SQL dynamique.
-- Pour modifier une fonction ou un trigger : nouvelle migration avec CREATE OR REPLACE FUNCTION / DROP + CREATE TRIGGER.

CREATE OR REPLACE FUNCTION history_trigger_fei() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored_cols text[] := ARRAY['updated_at', 'is_synced', 'version'];
  old_row jsonb := to_jsonb(OLD);
  valid_from timestamptz;
  valid_to timestamptz := clock_timestamp();
BEGIN
  IF TG_OP = 'UPDATE' AND (old_row - ignored_cols) = (to_jsonb(NEW) - ignored_cols) THEN
    RETURN NULL;
  END IF;

  SELECT max(upper(sys_period)) INTO valid_from FROM "FeiHistory" WHERE numero = OLD.numero;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "FeiHistory"
  SELECT * FROM jsonb_populate_record(NULL::"FeiHistory", old_row || jsonb_build_object(
    'history_id', nextval('"FeiHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to)
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "Fei"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_fei();

CREATE OR REPLACE FUNCTION history_trigger_carcasse() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored_cols text[] := ARRAY['updated_at', 'is_synced', 'version'];
  old_row jsonb := to_jsonb(OLD);
  valid_from timestamptz;
  valid_to timestamptz := clock_timestamp();
BEGIN
  IF TG_OP = 'UPDATE' AND (old_row - ignored_cols) = (to_jsonb(NEW) - ignored_cols) THEN
    RETURN NULL;
  END IF;

  SELECT max(upper(sys_period)) INTO valid_from FROM "CarcasseHistory" WHERE zacharie_carcasse_id = OLD.zacharie_carcasse_id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "CarcasseHistory"
  SELECT * FROM jsonb_populate_record(NULL::"CarcasseHistory", old_row || jsonb_build_object(
    'history_id', nextval('"CarcasseHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to)
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "Carcasse"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_carcasse();

CREATE OR REPLACE FUNCTION history_trigger_carcasse_intermediaire() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored_cols text[] := ARRAY['updated_at', 'is_synced', 'version'];
  old_row jsonb := to_jsonb(OLD);
  valid_from timestamptz;
  valid_to timestamptz := clock_timestamp();
BEGIN
  IF TG_OP = 'UPDATE' AND (old_row - ignored_cols) = (to_jsonb(NEW) - ignored_cols) THEN
    RETURN NULL;
  END IF;

  SELECT max(upper(sys_period)) INTO valid_from FROM "CarcasseIntermediaireHistory" WHERE fei_numero = OLD.fei_numero AND zacharie_carcasse_id = OLD.zacharie_carcasse_id AND intermediaire_id = OLD.intermediaire_id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "CarcasseIntermediaireHistory"
  SELECT * FROM jsonb_populate_record(NULL::"CarcasseIntermediaireHistory", old_row || jsonb_build_object(
    'history_id', nextval('"CarcasseIntermediaireHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to)
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "CarcasseIntermediaire"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_carcasse_intermediaire();

CREATE OR REPLACE FUNCTION history_trigger_user() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored_cols text[] := ARRAY['updated_at', 'is_synced', 'version'];
  old_row jsonb := to_jsonb(OLD);
  valid_from timestamptz;
  valid_to timestamptz := clock_timestamp();
BEGIN
  IF TG_OP = 'UPDATE' AND (old_row - ignored_cols) = (to_jsonb(NEW) - ignored_cols) THEN
    RETURN NULL;
  END IF;

  SELECT max(upper(sys_period)) INTO valid_from FROM "UserHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "UserHistory"
  SELECT * FROM jsonb_populate_record(NULL::"UserHistory", old_row || jsonb_build_object(
    'history_id', nextval('"UserHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to)
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "User"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_user();

CREATE OR REPLACE FUNCTION history_trigger_entity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored_cols text[] := ARRAY['updated_at', 'is_synced', 'version'];
  old_row jsonb := to_jsonb(OLD);
  valid_from timestamptz;
  valid_to timestamptz := clock_timestamp();
BEGIN
  IF TG_OP = 'UPDATE' AND (old_row - ignored_cols) = (to_jsonb(NEW) - ignored_cols) THEN
    RETURN NULL;
  END IF;

  SELECT max(upper(sys_period)) INTO valid_from FROM "EntityHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "EntityHistory"
  SELECT * FROM jsonb_populate_record(NULL::"EntityHistory", old_row || jsonb_build_object(
    'history_id', nextval('"EntityHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to)
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "Entity"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_entity();

CREATE OR REPLACE FUNCTION history_trigger_entity_and_user_relations() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored_cols text[] := ARRAY['updated_at', 'is_synced', 'version'];
  old_row jsonb := to_jsonb(OLD);
  valid_from timestamptz;
  valid_to timestamptz := clock_timestamp();
BEGIN
  IF TG_OP = 'UPDATE' AND (old_row - ignored_cols) = (to_jsonb(NEW) - ignored_cols) THEN
    RETURN NULL;
  END IF;

  SELECT max(upper(sys_period)) INTO valid_from FROM "EntityAndUserRelationsHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "EntityAndUserRelationsHistory"
  SELECT * FROM jsonb_populate_record(NULL::"EntityAndUserRelationsHistory", old_row || jsonb_build_object(
    'history_id', nextval('"EntityAndUserRelationsHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to)
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "EntityAndUserRelations"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_entity_and_user_relations();
