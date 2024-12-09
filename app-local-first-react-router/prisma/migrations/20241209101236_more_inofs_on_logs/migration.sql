/*
  Warnings:

  - Added the required column `user_role` to the `Logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Logs" ADD COLUMN     "carcasse_intermediaire_id" TEXT,
ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "fei_intermediaire_id" TEXT,
ADD COLUMN     "fei_numero" TEXT,
ADD COLUMN     "user_role" "UserRoles" NOT NULL,
ADD COLUMN     "zacharie_carcasse_id" TEXT;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_zacharie_carcasse_id_fkey" FOREIGN KEY ("zacharie_carcasse_id") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_fei_intermediaire_id_fkey" FOREIGN KEY ("fei_intermediaire_id") REFERENCES "FeiIntermediaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Logs" ADD CONSTRAINT "Logs_carcasse_intermediaire_id_fkey" FOREIGN KEY ("carcasse_intermediaire_id") REFERENCES "CarcasseIntermediaire"("fei_numero__bracelet__intermediaire_id") ON DELETE SET NULL ON UPDATE CASCADE;
