/*
  Warnings:

  - The primary key for the `CarcasseIntermediaire` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `CarcasseIntermediaire` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_pkey",
DROP COLUMN "id";
