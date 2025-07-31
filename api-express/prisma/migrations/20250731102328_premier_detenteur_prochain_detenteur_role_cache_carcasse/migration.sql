/*
  Warnings:

  - The `premier_detenteur_prochain_detenteur_type_cache` column on the `Carcasse` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "premier_detenteur_prochain_detenteur_role_cache" "FeiOwnerRole",
DROP COLUMN "premier_detenteur_prochain_detenteur_type_cache",
ADD COLUMN     "premier_detenteur_prochain_detenteur_type_cache" "FeiOwnerRole";
