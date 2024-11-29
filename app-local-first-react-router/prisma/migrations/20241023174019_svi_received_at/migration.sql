-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "svi_received_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CronJob" (
    "id" TEXT NOT NULL,
    "unique_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CronJob_unique_key_key" ON "CronJob"("unique_key");
