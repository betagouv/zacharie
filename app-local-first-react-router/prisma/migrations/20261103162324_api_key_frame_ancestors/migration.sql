-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "frame_ancestors" TEXT[] DEFAULT ARRAY[]::TEXT[];
