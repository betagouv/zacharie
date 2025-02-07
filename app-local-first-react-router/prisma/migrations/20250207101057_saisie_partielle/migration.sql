-- AlterTable
ALTER TABLE "Carcasse" ADD COLUMN     "svi_carcasse_saisie_partielle" BOOLEAN,
ADD COLUMN     "svi_carcasse_saisie_partielle_morceaux" TEXT[],
ADD COLUMN     "svi_carcasse_saisie_totale" BOOLEAN;
