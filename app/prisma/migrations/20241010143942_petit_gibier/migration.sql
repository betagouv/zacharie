-- CreateEnum
CREATE TYPE "CarcasseType" AS ENUM ('PETIT_GIBIER', 'GROS_GIBIER');

-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "nombre_d_animaux" INTEGER,
ADD COLUMN     "type" "CarcasseType";
