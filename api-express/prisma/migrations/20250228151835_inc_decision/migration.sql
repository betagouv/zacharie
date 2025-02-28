/*
  Warnings:

  - The `inc_certificat` column on the `Entity` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `inc_decision` column on the `Entity` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Entity" DROP COLUMN "inc_certificat",
ADD COLUMN     "inc_certificat" INTEGER,
DROP COLUMN "inc_decision",
ADD COLUMN     "inc_decision" INTEGER;
