-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reset_password_last_email_sent_at" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" TEXT;
