/*
  Warnings:

  - You are about to drop the column `premier_detenteur_user_name_cache` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `svi_assigned_to_fei_at` on the `Carcasse` table. All the data in the column will be lost.
  - You are about to drop the column `premier_detenteur_user_name_cache` on the `Fei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Carcasse" DROP COLUMN "svi_assigned_to_fei_at";