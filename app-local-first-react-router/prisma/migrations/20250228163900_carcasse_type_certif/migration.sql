-- AlterTable
ALTER TABLE "CarcasseCertificat" ADD COLUMN     "carcasse_type" "CarcasseType";

-- AlterTable
ALTER TABLE "Entity" ALTER COLUMN "inc_certificat" SET DEFAULT 0,
ALTER COLUMN "inc_decision" SET DEFAULT 0;
