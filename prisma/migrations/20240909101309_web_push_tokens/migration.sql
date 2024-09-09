-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "email" TEXT,
ADD COLUMN     "web_push_token" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "web_push_tokens" TEXT[];
