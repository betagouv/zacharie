/*
  Warnings:

  - You are about to drop the `_IntermediaireCarcasse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_IntermediaireCarcasse" DROP CONSTRAINT "_IntermediaireCarcasse_A_fkey";

-- DropForeignKey
ALTER TABLE "_IntermediaireCarcasse" DROP CONSTRAINT "_IntermediaireCarcasse_B_fkey";

-- DropTable
DROP TABLE "_IntermediaireCarcasse";

-- CreateTable
CREATE TABLE "_IntermediairesCarcasse" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_IntermediairesCarcasse_AB_unique" ON "_IntermediairesCarcasse"("A", "B");

-- CreateIndex
CREATE INDEX "_IntermediairesCarcasse_B_index" ON "_IntermediairesCarcasse"("B");

-- AddForeignKey
ALTER TABLE "_IntermediairesCarcasse" ADD CONSTRAINT "_IntermediairesCarcasse_A_fkey" FOREIGN KEY ("A") REFERENCES "Carcasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IntermediairesCarcasse" ADD CONSTRAINT "_IntermediairesCarcasse_B_fkey" FOREIGN KEY ("B") REFERENCES "Intermediaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
