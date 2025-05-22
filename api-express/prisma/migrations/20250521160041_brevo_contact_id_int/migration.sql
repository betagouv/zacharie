/*
  Warnings:

  - The `brevo_contact_id` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "brevo_contact_id",
ADD COLUMN     "brevo_contact_id" INTEGER;
