/*
  Warnings:

  - You are about to drop the column `departement_svi` on the `CarcasseCertificat` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CarcasseCertificat" DROP COLUMN "departement_svi",
ADD COLUMN     "prefecture_svi" TEXT;
