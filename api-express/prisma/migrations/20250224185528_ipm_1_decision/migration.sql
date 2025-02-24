/*
  Warnings:

  - The `svi_ipm1_decision` column on the `Carcasse` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "IPM1Decision" AS ENUM ('NON_RENSEIGNEE', 'MISE_EN_CONSIGNE');

-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "svi_ipm1_decision",
ADD COLUMN     "svi_ipm1_decision" "IPM1Decision";
