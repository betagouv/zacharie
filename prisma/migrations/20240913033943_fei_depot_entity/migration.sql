-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "premier_detenteur_depot_entity_id" TEXT,
ADD COLUMN     "premier_detenteur_depot_sauvage" TEXT;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_depot_entity_id_fkey" FOREIGN KEY ("premier_detenteur_depot_entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
