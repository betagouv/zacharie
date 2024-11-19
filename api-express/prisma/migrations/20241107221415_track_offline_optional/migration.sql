/*
  Warnings:

  - You are about to drop the `InterventionOnFei` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "InterventionOnFei" DROP CONSTRAINT "InterventionOnFei_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "InterventionOnFei" DROP CONSTRAINT "InterventionOnFei_fei_numero_fkey";

-- DropForeignKey
ALTER TABLE "InterventionOnFei" DROP CONSTRAINT "InterventionOnFei_user_id_fkey";

-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "examinateur_initial_offline" BOOLEAN,
ADD COLUMN     "premier_detenteur_offline" BOOLEAN;

-- AlterTable
ALTER TABLE "FeiIntermediaire" ADD COLUMN     "fei_intermediaire_offline" BOOLEAN;

-- DropTable
DROP TABLE "InterventionOnFei";
