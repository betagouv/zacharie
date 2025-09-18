-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "dedicated_to_entity_id" TEXT;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_dedicated_to_entity_id_fkey" FOREIGN KEY ("dedicated_to_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
