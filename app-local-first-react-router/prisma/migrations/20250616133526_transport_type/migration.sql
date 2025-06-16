/*
  Warnings:

  - The `premier_detenteur_depot_type` column on the `Fei` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `premier_detenteur_transport_type` column on the `Fei` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DepotType" AS ENUM ('CCG', 'ETG', 'AUCUN');

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('PREMIER_DETENTEUR', 'ETG', 'COLLECTEUR_PRO', 'AUCUN');

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "premier_detenteur_depot_type",
ADD COLUMN     "premier_detenteur_depot_type" "DepotType",
DROP COLUMN "premier_detenteur_transport_type",
ADD COLUMN     "premier_detenteur_transport_type" "TransportType";
