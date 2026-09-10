-- Annulation d'une FTP par son émetteur, tant que le laboratoire ne l'a pas réceptionnée.
ALTER TYPE "TrichineStatutLogistiqueFTP" ADD VALUE 'ANNULEE';

ALTER TABLE "TrichineFTP" ADD COLUMN "date_annulation" TIMESTAMP(3);
ALTER TABLE "TrichineFTP" ADD COLUMN "annulation_par_user_id" TEXT;
ALTER TABLE "TrichineFTP" ADD COLUMN "raison_annulation" TEXT;

CREATE INDEX "TrichineFTP_annulation_par_user_id_idx" ON "TrichineFTP"("annulation_par_user_id");

ALTER TABLE "TrichineFTP" ADD CONSTRAINT "TrichineFTP_annulation_par_user_id_fkey"
  FOREIGN KEY ("annulation_par_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
