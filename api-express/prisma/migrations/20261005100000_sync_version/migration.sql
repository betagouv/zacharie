-- AlterTable
ALTER TABLE "Fei" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version_user_id" TEXT;

-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version_user_id" TEXT;

-- AlterTable
ALTER TABLE "CarcasseIntermediaire" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "version_user_id" TEXT;
