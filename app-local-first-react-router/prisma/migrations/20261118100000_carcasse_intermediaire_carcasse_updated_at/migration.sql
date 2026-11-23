-- Copie de Carcasse.updated_at sur chaque CarcasseIntermediaire : la branche CarcasseIntermediaire du pull
-- GET /carcasse lit les carcasses d'une entité triées par date de carcasse, par un seul index.

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ADD COLUMN "carcasse_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CarcasseIntermediaireHistory" ADD COLUMN "carcasse_updated_at" TIMESTAMP(3);

-- Historique : la copie de la date de la carcasse n'est pas une modification de la ligne.
CREATE OR REPLACE FUNCTION history_trigger_carcasse_intermediaire() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  ignored_cols text[] := ARRAY['updated_at', 'is_synced', 'version', 'carcasse_updated_at'];
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

-- À l'écriture d'une CarcasseIntermediaire : la date est toujours relue sur la carcasse, jamais prise
-- dans les données envoyées par l'application.
CREATE OR REPLACE FUNCTION carcasse_updated_at_from_carcasse() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT updated_at INTO NEW.carcasse_updated_at FROM "Carcasse" WHERE zacharie_carcasse_id = NEW.zacharie_carcasse_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER carcasse_updated_at_from_carcasse BEFORE INSERT OR UPDATE ON "CarcasseIntermediaire"
  FOR EACH ROW EXECUTE FUNCTION carcasse_updated_at_from_carcasse();

-- À la mise à jour d'une carcasse : sa date est recopiée sur ses CarcasseIntermediaire.
CREATE OR REPLACE FUNCTION carcasse_updated_at_to_intermediaires() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "CarcasseIntermediaire" SET carcasse_updated_at = NEW.updated_at
  WHERE zacharie_carcasse_id = NEW.zacharie_carcasse_id AND carcasse_updated_at IS DISTINCT FROM NEW.updated_at;
  RETURN NULL;
END;
$$;

CREATE TRIGGER carcasse_updated_at_to_intermediaires AFTER UPDATE ON "Carcasse"
  FOR EACH ROW WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION carcasse_updated_at_to_intermediaires();

-- Lignes existantes
UPDATE "CarcasseIntermediaire" ci SET carcasse_updated_at = c.updated_at
FROM "Carcasse" c WHERE c.zacharie_carcasse_id = ci.zacharie_carcasse_id;

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_intermediaire_entity_id_carcasse_upda_idx" ON "CarcasseIntermediaire"("intermediaire_entity_id", "carcasse_updated_at" DESC, "zacharie_carcasse_id" DESC);
