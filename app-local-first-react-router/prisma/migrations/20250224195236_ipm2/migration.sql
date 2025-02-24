-- CreateEnum
CREATE TYPE "IPM2Decision" AS ENUM ('NON_RENSEIGNEE', 'LEVEE_DE_LA_CONSIGNE', 'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT');

-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "svi_ipm2_commentaire" TEXT,
ADD COLUMN     "svi_ipm2_date" TIMESTAMP(3),
ADD COLUMN     "svi_ipm2_decision" "IPM2Decision",
ADD COLUMN     "svi_ipm2_lesions_ou_motifs" TEXT[],
ADD COLUMN     "svi_ipm2_nombre_animaux" INTEGER,
ADD COLUMN     "svi_ipm2_pieces" TEXT[],
ADD COLUMN     "svi_ipm2_poids_saisie" DOUBLE PRECISION,
ADD COLUMN     "svi_ipm2_presentee_inspection" BOOLEAN,
ADD COLUMN     "svi_ipm2_protocole" "IPM1Protocole",
ADD COLUMN     "svi_ipm2_signed_at" TIMESTAMP(3),
ADD COLUMN     "svi_ipm2_traitement_assainissant" TEXT[],
ADD COLUMN     "svi_ipm2_traitement_assainissant_etablissement" TEXT,
ADD COLUMN     "svi_ipm2_traitement_assainissant_poids" DOUBLE PRECISION,
ADD COLUMN     "svi_ipm2_user_id" TEXT,
ADD COLUMN     "svi_ipm2_user_name_cache" TEXT;
