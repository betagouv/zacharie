-- DropForeignKey
ALTER TABLE "Carcasse" DROP CONSTRAINT "Carcasse_intermediaire_carcasse_refus_intermediaire_id_fkey";

-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_id_fkey";

-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_user_id_fkey";

-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_fei_numero_fkey";

-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey";

-- DropForeignKey
ALTER TABLE "Entity" DROP CONSTRAINT "Entity_coupled_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_examinateur_initial_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_current_owner_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_current_owner_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_fei_next_owner_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_premier_detenteur_depot_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_premier_detenteur_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_svi_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_svi_user_id_fkey";

-- DropForeignKey
ALTER TABLE "FeiIntermediaire" DROP CONSTRAINT "FeiIntermediaire_fei_intermediaire_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "FeiIntermediaire" DROP CONSTRAINT "FeiIntermediaire_fei_intermediaire_user_id_fkey";

-- DropForeignKey
ALTER TABLE "FeiIntermediaire" DROP CONSTRAINT "FeiIntermediaire_fei_numero_fkey";

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_coupled_entity_id_fkey" FOREIGN KEY ("coupled_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_user_id_fkey" FOREIGN KEY ("premier_detenteur_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_examinateur_initial_user_id_fkey" FOREIGN KEY ("examinateur_initial_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_premier_detenteur_depot_entity_id_fkey" FOREIGN KEY ("premier_detenteur_depot_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_entity_id_fkey" FOREIGN KEY ("svi_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_svi_user_id_fkey" FOREIGN KEY ("svi_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_current_owner_user_id_fkey" FOREIGN KEY ("fei_current_owner_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_current_owner_entity_id_fkey" FOREIGN KEY ("fei_current_owner_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fei" ADD CONSTRAINT "Fei_fei_next_owner_entity_id_fkey" FOREIGN KEY ("fei_next_owner_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_intermediaire_carcasse_refus_intermediaire_id_fkey" FOREIGN KEY ("intermediaire_carcasse_refus_intermediaire_id") REFERENCES "FeiIntermediaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_intermediaire_user_id_fkey" FOREIGN KEY ("fei_intermediaire_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_intermediaire_entity_id_fkey" FOREIGN KEY ("fei_intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey" FOREIGN KEY ("numero_bracelet") REFERENCES "Carcasse"("numero_bracelet") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_user_id_fkey" FOREIGN KEY ("fei_intermediaire_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_entity_id_fkey" FOREIGN KEY ("fei_intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_id_fkey" FOREIGN KEY ("fei_intermediaire_id") REFERENCES "FeiIntermediaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
