/*
  Warnings:

  - You are about to drop the column `intermediaire_depot_ccg_at` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `intermediaire_transport_date` on the `CarcasseIntermediaire` table. All the data in the column will be lost.
  - You are about to drop the column `intermediaire_transport_type` on the `CarcasseIntermediaire` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP COLUMN "intermediaire_depot_ccg_at",
DROP COLUMN "intermediaire_transport_date",
DROP COLUMN "intermediaire_transport_type";
