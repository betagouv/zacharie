-- CreateTable
CREATE TABLE "InterventionOnFei" (
    "id" TEXT NOT NULL,
    "fei_numero" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "role" "UserRoles" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "InterventionOnFei_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterventionOnFei_fei_numero_user_id_idx" ON "InterventionOnFei"("fei_numero", "user_id");

-- CreateIndex
CREATE INDEX "InterventionOnFei_fei_numero_entity_id_idx" ON "InterventionOnFei"("fei_numero", "entity_id");

-- AddForeignKey
ALTER TABLE "InterventionOnFei" ADD CONSTRAINT "InterventionOnFei_fei_numero_fkey" FOREIGN KEY ("fei_numero") REFERENCES "Fei"("numero") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOnFei" ADD CONSTRAINT "InterventionOnFei_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionOnFei" ADD CONSTRAINT "InterventionOnFei_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
