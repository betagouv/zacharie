/*
  Warnings:

  - The `intermediaire_role` column on the `CarcasseIntermediaire` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `fei_current_owner_role` column on the `Fei` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `fei_next_owner_role` column on the `Fei` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `fei_prev_owner_role` column on the `Fei` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "FeiOwnerRole" AS ENUM ('EXAMINATEUR_INITIAL', 'PREMIER_DETENTEUR', 'ETG', 'COLLECTEUR_PRO', 'SVI');

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP COLUMN "intermediaire_role",
ADD COLUMN     "intermediaire_role" "FeiOwnerRole";

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "fei_current_owner_role",
ADD COLUMN     "fei_current_owner_role" "FeiOwnerRole",
DROP COLUMN "fei_next_owner_role",
ADD COLUMN     "fei_next_owner_role" "FeiOwnerRole",
DROP COLUMN "fei_prev_owner_role",
ADD COLUMN     "fei_prev_owner_role" "FeiOwnerRole";

-- DropEnum
DROP TYPE "FeiOwnerType";
