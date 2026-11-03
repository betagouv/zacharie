-- Historique : une version dont le début et la fin tombent au même instant (created_at dans le futur, horloge de
-- l'appareil en avance) avait une période vide : upper(sys_period) valait NULL et cassait la lecture de l'historique.
-- Bornes '[]' : une telle version a désormais une période d'un instant.

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
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

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
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

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
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

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
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

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
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

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
    'sys_period', tstzrange(valid_from, valid_to, '[]')
  ));

  RETURN NULL;
END;
$$;

-- Versions déjà écrites avec une période vide : leur fin exacte est perdue, on la date de leur updated_at
UPDATE "FeiHistory" SET sys_period = tstzrange(coalesce(updated_at, created_at) AT TIME ZONE 'UTC', coalesce(updated_at, created_at) AT TIME ZONE 'UTC', '[]') WHERE isempty(sys_period);
UPDATE "CarcasseHistory" SET sys_period = tstzrange(coalesce(updated_at, created_at) AT TIME ZONE 'UTC', coalesce(updated_at, created_at) AT TIME ZONE 'UTC', '[]') WHERE isempty(sys_period);
UPDATE "CarcasseIntermediaireHistory" SET sys_period = tstzrange(coalesce(updated_at, created_at) AT TIME ZONE 'UTC', coalesce(updated_at, created_at) AT TIME ZONE 'UTC', '[]') WHERE isempty(sys_period);
UPDATE "UserHistory" SET sys_period = tstzrange(coalesce(updated_at, created_at) AT TIME ZONE 'UTC', coalesce(updated_at, created_at) AT TIME ZONE 'UTC', '[]') WHERE isempty(sys_period);
UPDATE "EntityHistory" SET sys_period = tstzrange(coalesce(updated_at, created_at) AT TIME ZONE 'UTC', coalesce(updated_at, created_at) AT TIME ZONE 'UTC', '[]') WHERE isempty(sys_period);
UPDATE "EntityAndUserRelationsHistory" SET sys_period = tstzrange(coalesce(updated_at, created_at) AT TIME ZONE 'UTC', coalesce(updated_at, created_at) AT TIME ZONE 'UTC', '[]') WHERE isempty(sys_period);
