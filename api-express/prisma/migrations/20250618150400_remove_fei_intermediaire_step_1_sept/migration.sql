/*
  Warnings:

  - You are about to drop the column `feiIntermediaireId` on the `Log` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Log" DROP CONSTRAINT "Log_feiIntermediaireId_fkey";

-- AlterTable
ALTER TABLE "Log" DROP COLUMN "feiIntermediaireId",
ADD COLUMN     "intermediaire_id" TEXT;
