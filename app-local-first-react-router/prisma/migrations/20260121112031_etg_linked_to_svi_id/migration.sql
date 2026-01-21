-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "etg_linked_to_svi_id" TEXT;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_etg_linked_to_svi_id_fkey" FOREIGN KEY ("etg_linked_to_svi_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
