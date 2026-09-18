-- DropColumns
ALTER TABLE "Password" DROP COLUMN IF EXISTS "failed_login_attempts";
ALTER TABLE "Password" DROP COLUMN IF EXISTS "locked_until";

-- CreateTable
CREATE TABLE "SecurityLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityLog_email_action_created_at_idx" ON "SecurityLog"("email", "action", "created_at");
