-- AlterTable
ALTER TABLE "Password" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Password" ADD COLUMN "locked_until" TIMESTAMP(3);
