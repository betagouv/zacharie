-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "svi_signed_by" TEXT;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_signed_by_fkey" FOREIGN KEY ("svi_signed_by") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
