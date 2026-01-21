-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "etg_linked_to_svi_id" TEXT;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_etg_linked_to_svi_id_fkey" FOREIGN KEY ("etg_linked_to_svi_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Entity"
SET etg_linked_to_svi_id = rel.entity_id
FROM "ETGAndEntityRelations" rel
WHERE "Entity".id = rel.etg_id
  AND rel.entity_type = 'SVI'
  AND rel.deleted_at IS NULL;