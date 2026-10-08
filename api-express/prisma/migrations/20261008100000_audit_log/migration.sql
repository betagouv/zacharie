-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "table_name" TEXT NOT NULL,
    "row_id" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "changed" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_table_name_row_id_created_at_idx" ON "AuditLog"("table_name", "row_id", "created_at");

-- Audit des écritures sur les tables critiques : chaque INSERT / UPDATE / DELETE ajoute une ligne dans "AuditLog".
-- UPDATE : seul le diff est stocké ({colonne: {old, new}}), et rien n'est écrit si seules des colonnes ignorées ont changé.
-- INSERT / DELETE : la ligne complète (sans les colonnes ignorées).
-- Les arguments du trigger sont les colonnes qui identifient la ligne, concaténées avec '|' dans row_id.
-- Pour modifier la fonction ou les triggers : nouvelle migration avec CREATE OR REPLACE FUNCTION / DROP + CREATE TRIGGER.

CREATE OR REPLACE FUNCTION audit_log_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  -- bruit (updated_at, is_synced, version, last_login_at) ou secrets (push tokens)
  ignored_cols text[] := ARRAY['updated_at', 'is_synced', 'version', 'last_login_at', 'web_push_tokens', 'native_push_tokens'];
  old_row jsonb;
  new_row jsonb;
  row_data jsonb;
  diff jsonb;
  pk_values text[];
  pk_col text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  row_data := coalesce(new_row, old_row);

  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, jsonb_build_object('old', old_row -> n.key, 'new', n.value))
      INTO diff
      FROM jsonb_each(new_row) n
     WHERE n.key <> ALL (ignored_cols)
       AND n.value IS DISTINCT FROM old_row -> n.key;
    IF diff IS NULL THEN
      RETURN NULL;
    END IF;
  ELSE
    diff := row_data - ignored_cols;
  END IF;

  FOREACH pk_col IN ARRAY TG_ARGV LOOP
    pk_values := array_append(pk_values, row_data ->> pk_col);
  END LOOP;

  INSERT INTO "AuditLog" (table_name, row_id, op, changed)
  VALUES (TG_TABLE_NAME, array_to_string(pk_values, '|'), TG_OP, diff);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_log ON "Fei";
CREATE TRIGGER audit_log AFTER INSERT OR UPDATE OR DELETE ON "Fei"
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger('numero');

DROP TRIGGER IF EXISTS audit_log ON "Carcasse";
CREATE TRIGGER audit_log AFTER INSERT OR UPDATE OR DELETE ON "Carcasse"
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger('zacharie_carcasse_id');

DROP TRIGGER IF EXISTS audit_log ON "CarcasseIntermediaire";
CREATE TRIGGER audit_log AFTER INSERT OR UPDATE OR DELETE ON "CarcasseIntermediaire"
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger('fei_numero', 'zacharie_carcasse_id', 'intermediaire_id');

DROP TRIGGER IF EXISTS audit_log ON "User";
CREATE TRIGGER audit_log AFTER INSERT OR UPDATE OR DELETE ON "User"
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger('id');

DROP TRIGGER IF EXISTS audit_log ON "Entity";
CREATE TRIGGER audit_log AFTER INSERT OR UPDATE OR DELETE ON "Entity"
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger('id');

DROP TRIGGER IF EXISTS audit_log ON "EntityAndUserRelations";
CREATE TRIGGER audit_log AFTER INSERT OR UPDATE OR DELETE ON "EntityAndUserRelations"
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger('id');
