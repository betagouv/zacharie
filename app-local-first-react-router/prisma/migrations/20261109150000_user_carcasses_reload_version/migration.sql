-- AlterTable
ALTER TABLE "User" ADD COLUMN "carcasses_reload_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserHistory" ADD COLUMN "carcasses_reload_version" INTEGER;
