/*
  Warnings:

  - The values [ACCEPTED,REJECTED] on the enum `EntityRelationStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `is_admin` on the `EntityAndUserRelations` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EntityRelationStatus_new" AS ENUM ('REQUESTED', 'MEMBER', 'ADMIN');
ALTER TABLE "EntityAndUserRelations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "EntityAndUserRelations" ALTER COLUMN "status" TYPE "EntityRelationStatus_new" USING ("status"::text::"EntityRelationStatus_new");
ALTER TYPE "EntityRelationStatus" RENAME TO "EntityRelationStatus_old";
ALTER TYPE "EntityRelationStatus_new" RENAME TO "EntityRelationStatus";
DROP TYPE "EntityRelationStatus_old";
ALTER TABLE "EntityAndUserRelations" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;

-- AlterTable
ALTER TABLE "EntityAndUserRelations" DROP COLUMN "is_admin",
ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
