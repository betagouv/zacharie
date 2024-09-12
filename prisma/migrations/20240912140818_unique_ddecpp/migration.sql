/*
  Warnings:

  - You are about to drop the column `numero_frei` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[numero_ddecpp]` on the table `Entity` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "numero_frei";

-- CreateIndex
CREATE UNIQUE INDEX "Entity_numero_ddecpp_key" ON "Entity"("numero_ddecpp");
