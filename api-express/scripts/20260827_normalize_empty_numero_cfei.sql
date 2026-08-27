-- Normalisation de User.numero_cfei : chaîne vide -> NULL.
--
-- Avant : le front envoie `numero_cfei: null` quand le champ est vide (clic dans le champ puis
--         sortie sans rien saisir, ou choix « formé à l'examen initial : oui » avant d'avoir saisi
--         le numéro). Côté API, `sanitize(null)` renvoyait '' : on stockait une chaîne vide, qui
--         comptait comme un changement de numéro (compte désactivé + notice interne « Numéro CFEI
--         changé » envoyée à l'équipe pour rien).
-- Après : l'API stocke NULL (normalizeNumeroCfei), ce script rattrape les lignes déjà en base.
--
-- Les comptes désactivés à tort par ce bug ne sont PAS réactivés ici : l'activation reste une
-- décision manuelle (admin).
--
-- À exécuter UNE FOIS, manuellement, sur la base (preprod puis prod), juste avant le merge.

BEGIN;

UPDATE "User"
SET numero_cfei = NULL
WHERE numero_cfei IS NOT NULL
  AND btrim(numero_cfei) = '';

COMMIT;
