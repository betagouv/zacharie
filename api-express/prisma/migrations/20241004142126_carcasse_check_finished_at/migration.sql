/*
  Warnings:

  - You are about to drop the column `check_finished_at` on the `CarcasseIntermediaire` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CarcasseIntermediaire" DROP COLUMN "check_finished_at",
ADD COLUMN     "carcasse_check_finished_at" TIMESTAMP(3);
