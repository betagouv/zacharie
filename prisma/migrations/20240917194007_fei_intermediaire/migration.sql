/*
  Warnings:

  - You are about to drop the `Intermediaire` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_IntermediairesCarcasse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Carcasse" DROP CONSTRAINT "Carcasse_intermediaire_carcasse_refus_intermediaire_id_fkey";

-- DropForeignKey
ALTER TABLE "Intermediaire" DROP CONSTRAINT "Intermediaire_fei_numero_fkey";

-- DropForeignKey
ALTER TABLE "Intermediaire" DROP CONSTRAINT "Intermediaire_intermediaire_entity_id_fkey";

-- DropForeignKey
ALTER TABLE "Intermediaire" DROP CONSTRAINT "Intermediaire_intermediaire_user_id_fkey";

-- DropForeignKey
ALTER TABLE "_IntermediairesCarcasse" DROP CONSTRAINT "_IntermediairesCarcasse_A_fkey";

-- DropForeignKey
ALTER TABLE "_IntermediairesCarcasse" DROP CONSTRAINT "_IntermediairesCarcasse_B_fkey";

-- DropTable
DROP TABLE "Intermediaire";

-- DropTable
DROP TABLE "_IntermediairesCarcasse";

-- CreateTable
CREATE TABLE "FeiIntermediaire" (
    "id" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "fei_intermediaire_user_id" TEXT NOT NULL,
    "fei_intermediaire_entity_id" TEXT NOT NULL,
    "commentaire" TEXT,
    "received_at" TIMESTAMP(3),
    "check_finished_at" TIMESTAMP(3),
    "handover_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "FeiIntermediaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FeiIntermediairesCarcasse" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "FeiIntermediaire_fei_numero_fei_intermediaire_user_id_fei_i_idx" ON "FeiIntermediaire"("fei_numero", "fei_intermediaire_user_id", "fei_intermediaire_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "_FeiIntermediairesCarcasse_AB_unique" ON "_FeiIntermediairesCarcasse"("A", "B");

-- CreateIndex
CREATE INDEX "_FeiIntermediairesCarcasse_B_index" ON "_FeiIntermediairesCarcasse"("B");

-- AddForeignKey
ALTER TABLE "Carcasse" ADD CONSTRAINT "Carcasse_intermediaire_carcasse_refus_intermediaire_id_fkey" FOREIGN KEY ("intermediaire_carcasse_refus_intermediaire_id") REFERENCES "FeiIntermediaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_intermediaire_user_id_fkey" FOREIGN KEY ("fei_intermediaire_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeiIntermediaire" ADD CONSTRAINT "FeiIntermediaire_fei_intermediaire_entity_id_fkey" FOREIGN KEY ("fei_intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" ADD CONSTRAINT "_FeiIntermediairesCarcasse_A_fkey" FOREIGN KEY ("A") REFERENCES "Carcasse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeiIntermediairesCarcasse" ADD CONSTRAINT "_FeiIntermediairesCarcasse_B_fkey" FOREIGN KEY ("B") REFERENCES "FeiIntermediaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
