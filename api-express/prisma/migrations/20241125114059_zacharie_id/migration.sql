/*
  Warnings:

  - Added the required column `zacharie_id` to the `Carcasse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "zacharie_id" TEXT NOT NULL;
