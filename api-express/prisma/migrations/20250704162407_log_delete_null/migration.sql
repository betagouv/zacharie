-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_fei_numero_fkey";

-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_zacharie_carcasse_id_fkey";

-- AlterTable
ALTER TABLE "Log" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_zacharie_carcasse_id_fkey" FOREIGN KEY ("zacharie_carcasse_id") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE SET NULL ON UPDATE CASCADE;
