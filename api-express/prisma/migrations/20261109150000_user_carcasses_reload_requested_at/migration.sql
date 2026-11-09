-- AlterTable
ALTER TABLE "User" ADD COLUMN "carcasses_reload_requested_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserHistory" ADD COLUMN "carcasses_reload_requested_at" TIMESTAMP(3);
