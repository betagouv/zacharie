/*
  Warnings:

  - You are about to drop the column `premier_detenteur_user_name_cache` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_user_name_cache` on the `Fei` table. All the data in the column will be lost.
  - You are about to drop the column `last_seen_at` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_last_seen_at_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "last_seen_at";

-- CreateIndex
CREATE INDEX "User_last_login_at_idx" ON "User"("last_login_at");
