-- Les rapports scannés (majoritaires) n'ont pas de texte : ils passent par un OCR asynchrone.
-- On conserve le texte lu, seule façon d'expliquer après coup un rattachement ou un résultat.
ALTER TABLE "TrichineDocument" ADD COLUMN "texte_extrait" TEXT;
ALTER TABLE "TrichineDocument" ADD COLUMN "texte_source" TEXT;
