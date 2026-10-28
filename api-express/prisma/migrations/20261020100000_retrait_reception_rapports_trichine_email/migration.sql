-- La réception des rapports trichine par email est retirée : l'expéditeur d'un email n'est pas
-- authentifié, un résultat lu dans un rapport reçu ainsi ne peut pas être appliqué en confiance.
-- Les rapports passent par le dépôt applicatif, toujours fait par un utilisateur connecté.

DROP TABLE "EmailEntrant";

DROP INDEX "TrichineDocument_email_message_id_nom_fichier_key";

ALTER TABLE "TrichineDocument" DROP COLUMN "email_message_id",
DROP COLUMN "email_expediteur",
DROP COLUMN "email_sujet",
DROP COLUMN "email_recu_at",
DROP COLUMN "rattachement_source",
DROP COLUMN "rattachement_indice",
DROP COLUMN "texte_extrait",
DROP COLUMN "texte_source";

-- Seuls les documents reçus par email n'avaient pas d'auteur
DELETE FROM "TrichineDocument" WHERE "ajoute_par_user_id" IS NULL;
ALTER TABLE "TrichineDocument" ALTER COLUMN "ajoute_par_user_id" SET NOT NULL;
