-- CreateEnum
CREATE TYPE "PoidsType" AS ENUM ('NON_DEPOUILLE', 'DEPOUILLE', 'NON_PLUMEE', 'PLUMEE');

-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "svi_ipm1_poids_type" "PoidsType",
ADD COLUMN     "svi_ipm2_poids_type" "PoidsType";
