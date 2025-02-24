-- CreateEnum
CREATE TYPE "IPM1Protocole" AS ENUM ('STANDARD', 'RENFORCE');

-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "svi_ipm1_commentaire" TEXT,
ADD COLUMN     "svi_ipm1_decision" TEXT,
ADD COLUMN     "svi_ipm1_duree_consigne" INTEGER,
ADD COLUMN     "svi_ipm1_lesions_ou_motifs" TEXT[],
ADD COLUMN     "svi_ipm1_nombre_animaux" INTEGER,
ADD COLUMN     "svi_ipm1_pieces" TEXT[],
ADD COLUMN     "svi_ipm1_poids_consigne" DOUBLE PRECISION,
ADD COLUMN     "svi_ipm1_presentee_inspection" BOOLEAN,
ADD COLUMN     "svi_ipm1_protocole" "IPM1Protocole",
ADD COLUMN     "svi_ipm1_signed_at" TIMESTAMP(3),
ADD COLUMN     "svi_ipm1_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_svi_ipm1_user_id_fkey" FOREIGN KEY ("svi_ipm1_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
