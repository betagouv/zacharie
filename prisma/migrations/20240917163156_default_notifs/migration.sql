-- AlterTable
ALTER TABLE "User" ALTER COLUMN "notifications" SET DEFAULT ARRAY['EMAIL', 'PUSH']::"UserNotifications"[];
