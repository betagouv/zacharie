/*
  Warnings:

  - You are about to drop the column `suivi_carcasse_user_address_ligne_1` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_address_ligne_2` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_code_postal` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_email` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_nom_de_famille` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_numero_centre_collecte` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_numero_cfei` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_prenom` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_raison_sociale` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_telephone` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_carcasse_user_ville` on the `SuiviCarcasse` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_address_ligne_1` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_address_ligne_2` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_code_postal` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_email` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_nom_de_famille` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_numero_centre_collecte` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_numero_cfei` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_prenom` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_raison_sociale` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_telephone` on the `SuiviFei` table. All the data in the column will be lost.
  - You are about to drop the column `suivi_par_user_ville` on the `SuiviFei` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SuiviCarcasse" DROP COLUMN "suivi_carcasse_user_address_ligne_1",
DROP COLUMN "suivi_carcasse_user_address_ligne_2",
DROP COLUMN "suivi_carcasse_user_code_postal",
DROP COLUMN "suivi_carcasse_user_email",
DROP COLUMN "suivi_carcasse_user_nom_de_famille",
DROP COLUMN "suivi_carcasse_user_numero_centre_collecte",
DROP COLUMN "suivi_carcasse_user_numero_cfei",
DROP COLUMN "suivi_carcasse_user_prenom",
DROP COLUMN "suivi_carcasse_user_raison_sociale",
DROP COLUMN "suivi_carcasse_user_telephone",
DROP COLUMN "suivi_carcasse_user_ville";

-- AlterTable
ALTER TABLE "SuiviFei" DROP COLUMN "suivi_par_user_address_ligne_1",
DROP COLUMN "suivi_par_user_address_ligne_2",
DROP COLUMN "suivi_par_user_code_postal",
DROP COLUMN "suivi_par_user_email",
DROP COLUMN "suivi_par_user_nom_de_famille",
DROP COLUMN "suivi_par_user_numero_centre_collecte",
DROP COLUMN "suivi_par_user_numero_cfei",
DROP COLUMN "suivi_par_user_prenom",
DROP COLUMN "suivi_par_user_raison_sociale",
DROP COLUMN "suivi_par_user_telephone",
DROP COLUMN "suivi_par_user_ville";
