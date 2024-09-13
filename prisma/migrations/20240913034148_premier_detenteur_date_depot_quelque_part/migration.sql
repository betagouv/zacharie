/*
  Warnings:

  - You are about to drop the column `premier_detenteur_date_depot_ccg` on the `Fei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "premier_detenteur_date_depot_ccg",
ADD COLUMN     "premier_detenteur_date_depot_quelque_part" TIMESTAMP(3);
