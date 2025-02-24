/*
  Warnings:

  - The values [NON_RENSEIGNEE] on the enum `IPM2Decision` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "IPM2Decision_new" AS ENUM ('LEVEE_DE_LA_CONSIGNE', 'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'TRAITEMENT_ASSAINISSANT');
ALTER TABLE "Carcasse" ALTER COLUMN "svi_ipm2_decision" TYPE "IPM2Decision_new" USING ("svi_ipm2_decision"::text::"IPM2Decision_new");
ALTER TYPE "IPM2Decision" RENAME TO "IPM2Decision_old";
ALTER TYPE "IPM2Decision_new" RENAME TO "IPM2Decision";
DROP TYPE "IPM2Decision_old";
COMMIT;
