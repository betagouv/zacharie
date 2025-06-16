/*
  Warnings:

  - You are about to drop the column `premier_detenteur_depot_set_at` on the `Fei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "premier_detenteur_depot_set_at",
ADD COLUMN     "premier_detenteur_depot_ccg_at" TIMESTAMP(3);
