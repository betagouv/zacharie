-- Les rapports d'analyses ne portent ni référence de pool ni référence de FTP : ils identifient
-- les échantillons par leur n° de scellé (le numéro de bracelet imprimé sur la FTP). On trace donc
-- quel indice a permis le rattachement — leur fiabilité n'est pas la même.
ALTER TABLE "TrichineDocument" ADD COLUMN "rattachement_indice" TEXT;
