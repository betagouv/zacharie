-- CreateEnum
CREATE TYPE "BugInvestigationStatus" AS ENUM ('EN_COURS', 'TERMINE', 'ERREUR');

-- CreateTable
CREATE TABLE "BugInvestigation" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "BugInvestigationStatus" NOT NULL DEFAULT 'EN_COURS',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "live_output" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugInvestigation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BugInvestigation_created_at_idx" ON "BugInvestigation"("created_at");

-- AddForeignKey
ALTER TABLE "BugInvestigation" ADD CONSTRAINT "BugInvestigation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
