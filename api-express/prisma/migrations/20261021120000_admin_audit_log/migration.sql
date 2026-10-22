-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "params" JSONB,
    "body" JSONB,
    "before" JSONB,
    "after" JSONB,
    "status_code" INTEGER NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_admin_user_id_created_at_idx" ON "AdminAuditLog"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "AdminAuditLog_target_type_target_id_created_at_idx" ON "AdminAuditLog"("target_type", "target_id", "created_at");

-- CreateIndex
CREATE INDEX "AdminAuditLog_created_at_idx" ON "AdminAuditLog"("created_at");
