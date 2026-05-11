-- CreateTable
CREATE TABLE "QuizResult" (
    "id" TEXT NOT NULL,
    "display_name" TEXT,
    "score" INTEGER NOT NULL,
    "total_questions" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "duration_seconds" INTEGER,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "QuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizResult_created_at_idx" ON "QuizResult"("created_at");

-- CreateIndex
CREATE INDEX "QuizResult_source_idx" ON "QuizResult"("source");

-- CreateIndex
CREATE INDEX "QuizResult_score_created_at_idx" ON "QuizResult"("score" DESC, "created_at");
