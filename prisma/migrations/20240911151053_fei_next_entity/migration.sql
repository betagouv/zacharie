-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_entity_id_fkey" FOREIGN KEY ("fei_next_owner_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
