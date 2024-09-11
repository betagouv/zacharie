-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_current_owner_user_id_fkey" FOREIGN KEY ("fei_current_owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_current_owner_entity_id_fkey" FOREIGN KEY ("fei_current_owner_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
