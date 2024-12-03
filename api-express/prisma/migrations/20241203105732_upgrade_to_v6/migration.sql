-- AlterTable
ALTER TABLE "_FeiIntermediairesCarcasse" ADD CONSTRAINT "_FeiIntermediairesCarcasse_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_FeiIntermediairesCarcasse_AB_unique";
