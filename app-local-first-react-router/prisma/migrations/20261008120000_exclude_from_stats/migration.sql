-- AlterTable
ALTER TABLE "User" ADD COLUMN     "exclude_from_stats" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Entity" ADD COLUMN     "exclude_from_stats" BOOLEAN NOT NULL DEFAULT false;
