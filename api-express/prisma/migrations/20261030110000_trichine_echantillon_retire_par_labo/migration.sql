-- AlterTable
ALTER TABLE "TrichineEchantillon" ADD COLUMN     "retire_du_pool_id" TEXT,
ADD COLUMN     "retire_par_labo_at" TIMESTAMP(3),
ADD COLUMN     "retire_par_labo_motif" TEXT,
ADD COLUMN     "retire_par_labo_user_id" TEXT;

-- CreateIndex
CREATE INDEX "TrichineEchantillon_retire_du_pool_id_idx" ON "TrichineEchantillon"("retire_du_pool_id");

-- AddForeignKey
ALTER TABLE "TrichineEchantillon" ADD CONSTRAINT "TrichineEchantillon_retire_par_labo_user_id_fkey" FOREIGN KEY ("retire_par_labo_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrichineEchantillon" ADD CONSTRAINT "TrichineEchantillon_retire_du_pool_id_fkey" FOREIGN KEY ("retire_du_pool_id") REFERENCES "TrichinePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
