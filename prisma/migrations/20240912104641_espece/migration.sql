/*
  Warnings:

  - Added the required column `categorie` to the `Carcasse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `espece` to the `Carcasse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "categorie" TEXT NOT NULL,
ADD COLUMN     "espece" TEXT NOT NULL;
