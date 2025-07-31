/*
  Warnings:

  - The `intermediaire_prochain_detenteur_type_cache` column on the `CarcasseIntermediaire` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ADD COLUMN     "intermediaire_prochain_detenteur_role_cache" "FeiOwnerRole",
DROP COLUMN "intermediaire_prochain_detenteur_type_cache",
ADD COLUMN     "intermediaire_prochain_detenteur_type_cache" "FeiOwnerRole";
