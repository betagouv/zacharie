-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "onboarded_at" TIMESTAMP(3),
ADD COLUMN     "prefilled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboarded_at" TIMESTAMP(3),
ADD COLUMN     "prefilled" BOOLEAN NOT NULL DEFAULT false;
