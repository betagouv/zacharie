-- Un rapport COFRAC peut désormais arriver par email sur l'adresse de dépôt : l'expéditeur n'est
-- pas nécessairement un utilisateur Zacharie, le document n'a donc plus toujours un auteur.
ALTER TABLE "TrichineDocument" ALTER COLUMN "ajoute_par_user_id" DROP NOT NULL;

ALTER TABLE "TrichineDocument" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "TrichineDocument" ADD COLUMN "nom_fichier" TEXT;
ALTER TABLE "TrichineDocument" ADD COLUMN "email_message_id" TEXT;
ALTER TABLE "TrichineDocument" ADD COLUMN "email_expediteur" TEXT;
ALTER TABLE "TrichineDocument" ADD COLUMN "email_sujet" TEXT;
ALTER TABLE "TrichineDocument" ADD COLUMN "email_recu_at" TIMESTAMP(3);

-- Idempotence des webhooks entrants : Brevo rejoue un webhook tant qu'il n'a pas eu son 2xx.
-- Les colonnes sont nulles pour les dépôts applicatifs, que Postgres n'unicise donc pas.
CREATE UNIQUE INDEX "TrichineDocument_email_message_id_nom_fichier_key" ON "TrichineDocument"("email_message_id", "nom_fichier");
