-- CreateIndex
CREATE INDEX "Fei_svi_closed_at_idx" ON "Fei"("svi_closed_at");

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_closed_by_user_id_fkey" FOREIGN KEY ("svi_closed_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
