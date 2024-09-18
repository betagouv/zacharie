-- CreateTable
CREATE TABLE "CarcasseIntermediaire" (
    "id" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "numero_bracelet" TEXT NOT NULL,
    "fei_intermediaire_id" TEXT NOT NULL,
    "fei_intermediaire_user_id" TEXT NOT NULL,
    "fei_intermediaire_entity_id" TEXT NOT NULL,
    "prise_en_charge" BOOLEAN,
    "refus" TEXT,
    "commentaire" TEXT,
    "check_finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CarcasseIntermediaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarcasseIntermediaire_fei_numero_numero_bracelet_fei_interm_idx" ON "CarcasseIntermediaire"("fei_numero", "numero_bracelet", "fei_intermediaire_id");

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_numero_bracelet_fkey" FOREIGN KEY ("numero_bracelet") REFERENCES "Carcasse"("numero_bracelet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_user_id_fkey" FOREIGN KEY ("fei_intermediaire_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_entity_id_fkey" FOREIGN KEY ("fei_intermediaire_entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarcasseIntermediaire" ADD CONSTRAINT "CarcasseIntermediaire_fei_intermediaire_id_fkey" FOREIGN KEY ("fei_intermediaire_id") REFERENCES "FeiIntermediaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
