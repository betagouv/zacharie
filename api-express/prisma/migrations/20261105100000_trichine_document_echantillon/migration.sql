-- AlterTable
ALTER TABLE "TrichineDocument" ADD COLUMN     "echantillon_id" TEXT;

-- CreateIndex
CREATE INDEX "TrichineDocument_echantillon_id_idx" ON "TrichineDocument"("echantillon_id");

-- AddForeignKey
ALTER TABLE "TrichineDocument" ADD CONSTRAINT "TrichineDocument_echantillon_id_fkey" FOREIGN KEY ("echantillon_id") REFERENCES "TrichineEchantillon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
