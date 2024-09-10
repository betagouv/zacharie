-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "fei_current_owner_entity_id" TEXT,
ADD COLUMN     "fei_current_owner_role" "UserRoles",
ADD COLUMN     "fei_current_owner_user_id" TEXT;
