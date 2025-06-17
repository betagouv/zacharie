/*
  Warnings:

  - You are about to drop the column `svi_signed_at` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `svi_signed_by` on the `Fei` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Fei" DROP CONSTRAINT "Fei_svi_signed_by_fkey";

-- DropIndex
DROP INDEX "Fei_svi_signed_at_idx";

-- AlterTable
ALTER TABLE "Fei" DROP COLUMN "svi_signed_at",
DROP COLUMN "svi_signed_by";
