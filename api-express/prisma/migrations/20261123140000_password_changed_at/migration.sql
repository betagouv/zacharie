-- Date du dernier changement de mot de passe : tout jeton de session émis avant est refusé.

-- AlterTable
ALTER TABLE "Password" ADD COLUMN "password_changed_at" TIMESTAMP(3);
