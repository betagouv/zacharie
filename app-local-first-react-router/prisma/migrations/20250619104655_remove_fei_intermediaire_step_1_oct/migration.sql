/*
  Warnings:

  - You are about to drop the `_FeiIntermediairesCarcasse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Carcasse" DROP CONSTRAINT "Carcasse_intermediaire_carcasse_refus_intermediaire_id_fkey";

-- DropForeignKey
ALTER TABLE "FeiIntermediaire" DROP CONSTRAINT "FeiIntermediaire_fei_intermediaire_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "FeiIntermediaire" DROP CONSTRAINT "FeiIntermediaire_fei_intermediaire_user_id_fkey";

-- DropForeignKey
ALTER TABLE "FeiIntermediaire" DROP CONSTRAINT "FeiIntermediaire_fei_numero_fkey";

-- DropForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" DROP CONSTRAINT "_FeiIntermediairesCarcasse_A_fkey";

-- DropForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" DROP CONSTRAINT "_FeiIntermediairesCarcasse_B_fkey";

-- DropTable
DROP TABLE "_FeiIntermediairesCarcasse";
