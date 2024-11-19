-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_user_id_fkey" FOREIGN KEY ("fei_next_owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
