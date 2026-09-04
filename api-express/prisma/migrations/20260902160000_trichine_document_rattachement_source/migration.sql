-- Le rattachement d'un rapport reçu par email se fait d'abord sur la référence de pool lue dans le
-- PDF, et seulement à défaut sur celle du sujet / du corps du message : on trace laquelle a servi.
ALTER TABLE "TrichineDocument" ADD COLUMN "rattachement_source" TEXT;
