/*
  Warnings:

  - The values [EXAMINATEUR_INITIAL,PREMIER_DETENTEUR,CCG] on the enum `UserRoles` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `roleEtgAndTransport` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserEtgRoles" AS ENUM ('TRANSPORT', 'RECEPTION');

-- AlterEnum
BEGIN;
CREATE TYPE "UserRoles_new" AS ENUM ('ADMIN', 'CHASSEUR', 'COLLECTEUR_PRO', 'ETG', 'SVI');
ALTER TABLE "User" ALTER COLUMN "roles" TYPE "UserRoles_new"[] USING ("roles"::text::"UserRoles_new"[]);
ALTER TABLE "Log" ALTER COLUMN "user_role" TYPE "UserRoles_new" USING ("user_role"::text::"UserRoles_new");
ALTER TYPE "UserRoles" RENAME TO "UserRoles_old";
ALTER TYPE "UserRoles_new" RENAME TO "UserRoles";
DROP TYPE "UserRoles_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "roleEtgAndTransport",
ADD COLUMN     "etg_roles" "UserEtgRoles"[];
