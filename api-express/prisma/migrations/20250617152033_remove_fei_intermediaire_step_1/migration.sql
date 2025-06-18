-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ADD COLUMN     "decision_at" TIMESTAMP(3),
ADD COLUMN     "fei_intermediaire_role" "UserRoles",
ADD COLUMN     "prise_en_charge_at" TIMESTAMP(3);
