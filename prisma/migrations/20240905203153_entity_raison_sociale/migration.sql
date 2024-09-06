/*
  Warnings:

  - You are about to drop the column `name` on the `Entity` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "name",
ADD COLUMN     "raison_sociale" TEXT;
