/*
  Warnings:

  - You are about to drop the column `reset_password_last_email_sent_at` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `reset_password_token` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Password" ADD COLUMN     "reset_password_last_email_sent_at" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "reset_password_last_email_sent_at",
DROP COLUMN "reset_password_token";
