/*
  Warnings:

  - You are about to drop the column `svi_received_at` on the `Fei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "svi_received_at",
ADD COLUMN     "svi_assigned_at" TIMESTAMP(3);
