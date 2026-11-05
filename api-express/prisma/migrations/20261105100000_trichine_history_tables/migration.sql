-- Historique des tables trichine, même mécanisme que la migration history_tables : avant chaque UPDATE / DELETE,
-- un trigger copie la ligne précédente dans "<Table>History", par nom de colonne.
-- TrichinePoolFTP n'a pas de created_at : la première version commence à date_ajout.

-- CreateTable
CREATE TABLE "TrichineEchantillonHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
    "reference_echantillon" TEXT,
    "zacharie_carcasse_id" TEXT,
    "preleve_par_user_id" TEXT,
    "preleve_par_entity_id" TEXT,
    "type" "TrichineType",
    "site_prelevement" "TrichineSitePrelevement",
    "masse_grammes" INTEGER,
    "date_prelevement" DATE,
    "statut" "TrichineStatutAnalyse",
    "resultat_analyse" "TrichineResultatAnalyse",
    "pool_id" TEXT,
    "retire_par_labo_at" TIMESTAMP(3),
    "retire_par_labo_motif" TEXT,
    "retire_par_labo_user_id" TEXT,
    "retire_du_pool_id" TEXT,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "TrichineEchantillonHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "TrichinePoolHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
    "reference_pool" TEXT,
    "cree_par_user_id" TEXT,
    "cree_par_entity_id" TEXT,
    "type" "TrichineType",
    "pool_parent_id" TEXT,
    "date_constitution" DATE,
    "date_reception" TIMESTAMP(3),
    "date_debut_analyse" DATE,
    "date_fin_analyse" DATE,
    "statut" "TrichineStatutAnalyse",
    "resultat_analyse" "TrichineResultatAnalyse",
    "parasite_identifie" TEXT,
    "nombre_larves_lvd" INTEGER,
    "nombre_larves_lnr" INTEGER,
    "refus_par_user_id" TEXT,
    "raison_refus" TEXT,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "TrichinePoolHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "TrichineFTPHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
    "numero_fiche" TEXT,
    "date_creation" TIMESTAMP(3),
    "date_envoi" TIMESTAMP(3),
    "expediteur_user_id" TEXT,
    "expediteur_entity_id" TEXT,
    "destinataire_entity_id" TEXT,
    "ftp_parent_id" TEXT,
    "statut_logistique" "TrichineStatutLogistiqueFTP",
    "statut_analytique" "TrichineStatutAnalyse",
    "date_annulation" TIMESTAMP(3),
    "annulation_par_user_id" TEXT,
    "raison_annulation" TEXT,
    "mode_transport" TEXT,
    "conditions_conservation" TEXT,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "TrichineFTPHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "TrichinePoolFTPHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
    "pool_id" TEXT,
    "ftp_id" TEXT,
    "date_ajout" TIMESTAMP(3),
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "TrichinePoolFTPHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "TrichineAliasHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
    "reference" TEXT,
    "objet_type" "TrichineAliasObjet",
    "entity_id" TEXT,
    "echantillon_id" TEXT,
    "pool_id" TEXT,
    "ftp_id" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "TrichineAliasHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "TrichineDocumentHistory" (
    "history_id" BIGSERIAL NOT NULL,
    "id" TEXT,
    "type" TEXT,
    "source" TEXT,
    "fichier_url" TEXT,
    "nom_fichier" TEXT,
    "date_ajout" TIMESTAMP(3),
    "ajoute_par_user_id" TEXT,
    "pool_id" TEXT,
    "ftp_id" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "is_synced" BOOLEAN,
    "history_op" TEXT NOT NULL,
    "sys_period" tstzrange NOT NULL,

    CONSTRAINT "TrichineDocumentHistory_pkey" PRIMARY KEY ("history_id")
);

-- CreateIndex
CREATE INDEX "TrichineEchantillonHistory_id_idx" ON "TrichineEchantillonHistory"("id");

-- CreateIndex
CREATE INDEX "TrichinePoolHistory_id_idx" ON "TrichinePoolHistory"("id");

-- CreateIndex
CREATE INDEX "TrichineFTPHistory_id_idx" ON "TrichineFTPHistory"("id");

-- CreateIndex
CREATE INDEX "TrichinePoolFTPHistory_id_idx" ON "TrichinePoolFTPHistory"("id");

-- CreateIndex
CREATE INDEX "TrichineAliasHistory_id_idx" ON "TrichineAliasHistory"("id");

-- CreateIndex
CREATE INDEX "TrichineDocumentHistory_id_idx" ON "TrichineDocumentHistory"("id");


CREATE OR REPLACE FUNCTION history_trigger_trichine_echantillon() RETURNS trigger
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

  SELECT max(upper(sys_period)) INTO valid_from FROM "TrichineEchantillonHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "TrichineEchantillonHistory"
  SELECT * FROM jsonb_populate_record(NULL::"TrichineEchantillonHistory", old_row || jsonb_build_object(
    'history_id', nextval('"TrichineEchantillonHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "TrichineEchantillon"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_trichine_echantillon();

CREATE OR REPLACE FUNCTION history_trigger_trichine_pool() RETURNS trigger
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

  SELECT max(upper(sys_period)) INTO valid_from FROM "TrichinePoolHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "TrichinePoolHistory"
  SELECT * FROM jsonb_populate_record(NULL::"TrichinePoolHistory", old_row || jsonb_build_object(
    'history_id', nextval('"TrichinePoolHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "TrichinePool"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_trichine_pool();

CREATE OR REPLACE FUNCTION history_trigger_trichine_ftp() RETURNS trigger
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

  SELECT max(upper(sys_period)) INTO valid_from FROM "TrichineFTPHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "TrichineFTPHistory"
  SELECT * FROM jsonb_populate_record(NULL::"TrichineFTPHistory", old_row || jsonb_build_object(
    'history_id', nextval('"TrichineFTPHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "TrichineFTP"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_trichine_ftp();

CREATE OR REPLACE FUNCTION history_trigger_trichine_pool_ftp() RETURNS trigger
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

  SELECT max(upper(sys_period)) INTO valid_from FROM "TrichinePoolFTPHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'date_ajout')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "TrichinePoolFTPHistory"
  SELECT * FROM jsonb_populate_record(NULL::"TrichinePoolFTPHistory", old_row || jsonb_build_object(
    'history_id', nextval('"TrichinePoolFTPHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "TrichinePoolFTP"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_trichine_pool_ftp();

CREATE OR REPLACE FUNCTION history_trigger_trichine_alias() RETURNS trigger
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

  SELECT max(upper(sys_period)) INTO valid_from FROM "TrichineAliasHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "TrichineAliasHistory"
  SELECT * FROM jsonb_populate_record(NULL::"TrichineAliasHistory", old_row || jsonb_build_object(
    'history_id', nextval('"TrichineAliasHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "TrichineAlias"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_trichine_alias();

CREATE OR REPLACE FUNCTION history_trigger_trichine_document() RETURNS trigger
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

  SELECT max(upper(sys_period)) INTO valid_from FROM "TrichineDocumentHistory" WHERE id = OLD.id;
  valid_from := least(coalesce(valid_from, (old_row ->> 'created_at')::timestamp AT TIME ZONE 'UTC', valid_to), valid_to);

  INSERT INTO "TrichineDocumentHistory"
  SELECT * FROM jsonb_populate_record(NULL::"TrichineDocumentHistory", old_row || jsonb_build_object(
    'history_id', nextval('"TrichineDocumentHistory_history_id_seq"'),
    'history_op', TG_OP,
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

CREATE TRIGGER history AFTER UPDATE OR DELETE ON "TrichineDocument"
  FOR EACH ROW EXECUTE FUNCTION history_trigger_trichine_document();
