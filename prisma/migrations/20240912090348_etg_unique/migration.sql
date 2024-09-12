/*
  Warnings:

  - You are about to drop the column `date_depot_centre_collecte` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `signed_at` on the `Intermediaire` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "date_depot_centre_collecte",
ADD COLUMN     "detenteur_initial_date_depot_centre_collecte" TIMESTAMP(3),
ADD COLUMN     "etg_check_finished_at" TIMESTAMP(3),
ADD COLUMN     "etg_commentaire" TEXT,
ADD COLUMN     "etg_entity_id" TEXT,
ADD COLUMN     "etg_received_at" TIMESTAMP(3),
ADD COLUMN     "etg_user_id" TEXT;

-- AlterTable
ALTER TABLE "Intermediaire" DROP COLUMN "signed_at",
ADD COLUMN     "check_finished_at" TIMESTAMP(3),
ADD COLUMN     "handover_at" TIMESTAMP(3),
ADD COLUMN     "received_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_etg_entity_id_fkey" FOREIGN KEY ("etg_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_etg_user_id_fkey" FOREIGN KEY ("etg_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;