-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_sous_traite_by_entity_id_fkey" FOREIGN KEY ("fei_next_owner_sous_traite_by_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_sous_traite_by_user_id_fkey" FOREIGN KEY ("fei_next_owner_sous_traite_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
