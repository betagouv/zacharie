/*
  Warnings:

  - The values [MANQUANTE] on the enum `CarcasseStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CarcasseStatus_new" AS ENUM ('MANQUANTE_ETG_COLLECTEUR', 'REFUS_ETG_COLLECTEUR', 'SANS_DECISION', 'ACCEPTE', 'CONSIGNE', 'MANQUANTE_SVI', 'SAISIE_TOTALE', 'SAISIE_PARTIELLE', 'LEVEE_DE_CONSIGNE', 'TRAITEMENT_ASSAINISSANT');
ALTER TABLE "Carcasse" ALTER COLUMN "svi_carcasse_status" TYPE "CarcasseStatus_new" USING ("svi_carcasse_status"::text::"CarcasseStatus_new");
ALTER TYPE "CarcasseStatus" RENAME TO "CarcasseStatus_old";
ALTER TYPE "CarcasseStatus_new" RENAME TO "CarcasseStatus";
DROP TYPE "CarcasseStatus_old";
COMMIT;
