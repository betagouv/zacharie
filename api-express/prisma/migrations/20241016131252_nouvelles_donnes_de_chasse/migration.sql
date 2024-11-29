-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "heure_evisceration_derniere_carcasse" TEXT,
ADD COLUMN     "heure_mise_a_mort_premiere_carcasse" TEXT,
ADD COLUMN     "premier_detenteur_entity_id" TEXT;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_entity_id_fkey" FOREIGN KEY ("premier_detenteur_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
