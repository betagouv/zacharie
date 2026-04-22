-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_svi_entity_id_fkey" FOREIGN KEY ("svi_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
