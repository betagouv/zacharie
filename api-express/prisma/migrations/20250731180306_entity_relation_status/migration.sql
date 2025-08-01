-- CreateEnum
CREATE TYPE "EntityRelationStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "EntityAndUserRelations" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "EntityRelationStatus" NOT NULL DEFAULT 'ACCEPTED';
