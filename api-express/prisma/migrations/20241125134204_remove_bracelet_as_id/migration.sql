/*
  Warnings:

  - The primary key for the `Carcasse` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `zacharie_carcasse_id` on table `Carcasse` required. This step will fail if there are existing NULL values in that column.
  - Made the column `zacharie_carcasse_id` on table `CarcasseIntermediaire` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CarcasseIntermediaire" DROP CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey";

-- DropForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" DROP CONSTRAINT "_FeiIntermediairesCarcasse_A_fkey";

-- AlterTable
ALTER TABLE "Carcasse" DROP CONSTRAINT "Carcasse_pkey",
ALTER COLUMN "zacharie_carcasse_id" SET NOT NULL,
ADD CONSTRAINT "Carcasse_pkey" PRIMARY KEY ("zacharie_carcasse_id");

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ALTER COLUMN "zacharie_carcasse_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_zacharie_carcasse_id_fkey" FOREIGN KEY ("zacharie_carcasse_id") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" ADD CONSTRAINT "_FeiIntermediairesCarcasse_A_fkey" FOREIGN KEY ("A") REFERENCES "Carcasse"("zacharie_carcasse_id") ON DELETE CASCADE ON UPDATE CASCADE;
