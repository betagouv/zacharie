# 0006. Verrou optimiste des fiches, carcasses et lignes d'intermédiaire

## Contexte

Hors ligne, un utilisateur peut modifier une copie périmée d'une carcasse qu'un autre utilisateur a modifiée entre-temps. `syncCarcasse` applique le corps sans comparer `updated_at` : sans verrou, la copie périmée écraserait l'écriture plus récente.

## Décision

- `api-express/src/utils/sync-version.ts` (`isStaleWrite`, `nextVersion`). Le client renvoie tel quel le `version` reçu du serveur et ne l'incrémente jamais : sinon n modifications hors ligne passeraient devant l'écriture d'un autre. Le serveur incrémente à chaque écriture. Sans version envoyée, on prend 0.
- Une version inférieure n'est périmée que si l'écriture plus récente vient d'un autre utilisateur. `syncData` annule côté client une requête en cours quand une nouvelle part, mais le serveur la traite : la requête suivante du même appareil arrive avec une version dépassée par sa propre écriture et doit passer. `userId` est l'auteur (null pour un cron).
- Une écriture périmée n'est pas appliquée (refus « Version obsolète »). On touche la ou les carcasses concernées pour que le delta (fondé sur `carcasse.updated_at`) ramène la version à jour, qui remplace la copie locale.
- Les demandes de modification portent la version et la date de la copie locale au moment de l'action, pour retrouver côté serveur ce qu'une écriture refusée avait sous les yeux.

## Conséquences

- Ajouter `nextVersion` à toute nouvelle écriture d'une fiche, carcasse ou ligne d'intermédiaire, y compris dans l'admin (corrections, soft delete), sinon les copies locales plus anciennes ne deviennent pas périmées.
- La saisie hors ligne refusée est perdue pour l'utilisateur (test e2e `143-version-obsolete-ecrasee`).
