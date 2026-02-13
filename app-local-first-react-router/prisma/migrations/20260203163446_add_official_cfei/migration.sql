-- CreateTable
CREATE TABLE "OfficialCfei" (
    "numero_cfei" TEXT NOT NULL,
    "nom" TEXT,
    "prenom" TEXT,
    "departement" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialCfei_pkey" PRIMARY KEY ("numero_cfei")
);
