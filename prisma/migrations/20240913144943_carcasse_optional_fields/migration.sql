-- AlterTable
ALTER TABLE "Carcasse" ALTER COLUMN "heure_mise_a_mort" DROP NOT NULL,
ALTER COLUMN "heure_evisceration" DROP NOT NULL,
ALTER COLUMN "espece" DROP NOT NULL,
ALTER COLUMN "categorie" DROP NOT NULL;
