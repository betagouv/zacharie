-- AlterEnum
ALTER TYPE "UserRoles" ADD VALUE 'CHASSEUR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roleEtgAndTransport" BOOLEAN NOT NULL DEFAULT false;
