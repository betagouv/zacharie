# 0025. Trichine : principes, références et alias

## Contexte

La recherche de trichine sur le sanglier est réglementaire. Les spécifications sont dans [trichine.md](../trichine.md) et le suivi dans [trichine-todo.md](../trichine-todo.md). Les objets (échantillon E, pool P, fiche de transmission des prélèvements FTP F) circulent entre le SVI émetteur, le LVD et le LNR, qui les citent au téléphone et sur papier.

## Décision

**Feature flag et architecture** :

- Le backend lit la même variable que le frontend, `VITE_FEATURE_TRICHINE` (`TRICHINE_FEATURE_ENABLED`, `api-express/src/config.ts`). Sans elle, les routes trichine n'existent pas (404, `middlewares/trichine-feature.ts`) et les garde-fous sangliers sont inactifs. Côté app, l'espace est invisible en production sans le flag au build, toujours actif en dev ; l'espace laboratoire exige aussi le rôle LABORATOIRE.
- Pas de local-first pour la trichine : les résultats viennent des laboratoires, le flux exige d'être en ligne. La section trichine de la carte carcasse interroge le serveur directement.
- Le sanglier est la seule espèce concernée (`TRICHINE_ESPECE_CONCERNEE`). Les champs String évolutifs (`TrichineActionRequise`…) ne sont pas des enums Postgres, pour itérer sans migration (§4.10).
- Routes émetteur dans `controllers/trichine.ts`, routes laboratoire dans `controllers/laboratoire.ts`. L'émetteur est le SVI, en circuit agréé.

**Références** (`api-express/src/utils/trichine.ts`) :

- Format `{E|P|F}-{YY}-{code établissement}-{séquence}`. Le code est le code trichine de l'entité qui fait l'acte, sinon l'id de l'utilisateur (5 caractères). Le prochain code libre d'un type (`SVI01`, `LAB07`, `PD142`…) se lit sur la partie numérique (une comparaison de chaînes placerait `SVI9` devant `SVI10`). Un prélèvement en lot réserve `count` références en une lecture ; l'unicité est garantie par la contrainte `@unique` et `withReferenceRetry` (recalcul sur P2002).
- Les routes de lecture prennent la référence métier, pas l'uuid : URL copiable, numéro lu sur la fiche papier. Les routes d'action gardent l'id.

**Point de non-retour** : une FTP « partie » (`isFtpPartie`) a quitté l'émetteur avec la fiche papier dans le colis ; ce qu'elle contient est figé. Un brouillon n'est pas parti ; une fiche annulée ne l'est plus. L'UI ne fait que masquer ce qui échouerait ; le backend arbitre.

**Visibilité** : un SVI voit le travail de tout son service ; un premier détenteur le sien. Tout `entity_id` venu du client est vérifié avec `userBelongsToEntity`. Les laboratoires reçoivent une projection stricte (§10.2), voir [0027](0027-trichine-laboratoires-et-resultats.md). Le nombre de larves est omis de toutes les requêtes Prisma (`api-express/src/prisma-omit.ts`) et réintégré pour les laboratoires (`omit: avecNombreLarves`).

**Alias** (`utils/trichine-alias.ts`, `controllers/trichine-alias.ts`) :

- Chaque entité (SVI, LVD, LNR) peut donner sa référence interne (LIMS, registre) à un objet qu'elle voit ; tous les acteurs voient les alias. Un agent de plusieurs services pose l'alias au nom du service de l'objet s'il en fait partie, sinon de son premier service.
- Gel côté SVI : dès que la FTP n'est plus en brouillon, ou que le pool / l'échantillon est porté par une FTP partie (ses références sont imprimées). Gel côté laboratoire : analyses terminées ou fiche clôturée. Le motif du gel est renvoyé.
- Unicité par entité et type, insensible à la casse. Le filtre Prisma insensible passe par ILIKE (`_` et `%` jokers) : on retient en mémoire la seule référence vraiment égale, et la recherche d'un alias se fait par égalité sur `lower(reference)`. Conflit simultané tranché par l'index unique.
- Alias saisis à la création validés avant de créer l'objet ; posés au nom du service d'inspection (`entiteSviPourObjet`). Une chaîne vide vaut « pas d'alias ». Un objet supprimé libère ses alias.
- Affichage : la référence du laboratoire passe en titre, celle de Zacharie en dessous ; le PDF affiche les références de chaque acteur (« SVI 35 : A-12 · LVD 35 : 2026-87 »). Pas de cache module des entités de l'utilisateur (il survivrait à une déconnexion).

**Notifications** (`notifyTrichineUsers`) : une `TrichineNotification` par utilisateur, puis push / email mis en file sans `await` (file commune limitée à un envoi par seconde). `notificationLogAction` unique par évènement. L'émetteur d'une FTP = l'expéditeur et tous ceux de l'entité expéditrice. Emails HTML en tables et styles inline (`templates/trichine-email.ts`), fonctionnalité en test.

## Conséquences

- La règle « sanglier accepté seulement avec un résultat négatif » existe côté API (`carcasseAvecTrichineNegatifFilter`, `syncCarcasse`, cron) et côté app (fail-closed).
- Tests : `trichine-*.test.ts`, `laboratoire-*.test.ts`, e2e `chains/166-trichine-circuit-agree-negatif`.
