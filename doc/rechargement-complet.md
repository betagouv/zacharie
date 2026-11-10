# Rechargement complet des données locales

Deux déclencheurs forcent un rechargement complet du périmètre de carcasses d'un appareil :

- la date `FORCE_FULL_RELOAD_AFTER` (`api-express/src/utils/force-full-reload.ts`) : pour tous les
  utilisateurs ;
- le compteur `User.carcasses_reload_version` : pour un seul utilisateur, sur tous ses appareils.

Le serveur décide, le client obéit : il ne compare jamais lui-même les dates ni les versions.

## Pourquoi

Le pull delta (`GET /carcasse?after=<lastUpdateFromServer>`) ne renvoie que les carcasses du périmètre
de l'utilisateur modifiées depuis son dernier pull. Une carcasse qui sort du périmètre, ou qui est
corrigée en base sans que son `updated_at` bouge, n'est jamais renvoyée : la copie locale reste figée.
De même, quand un utilisateur rejoint une entité, les carcasses déjà existantes de l'entité ne lui
arrivent jamais.

## Ce que fait le serveur

`GET /carcasse` (`api-express/src/controllers/carcasse.ts`) répond `fullReload: true`, sans filtre
`updated_at` (tout le périmètre), si :

- le curseur `after` du client est antérieur à `FORCE_FULL_RELOAD_AFTER` ;
- ou le paramètre `reloadVersion` envoyé par le client est inférieur à `User.carcasses_reload_version`.
  Sans `reloadVersion`, pas de rechargement.

Un premier chargement (`after = 0`) renvoie aussi tout le périmètre. La réponse porte toujours
`reloadVersion: User.carcasses_reload_version`.

## Ce que fait le client

`app-local-first-react-router/src/utils/load-carcasses.ts` :

- envoie à chaque page la version stockée (`carcassesReloadVersion` du store zustand) ;
- sur `fullReload`, remplace les fiches, carcasses, `CarcasseIntermediaire` et demandes de
  modification locales par la réponse. **Les seules lignes locales gardées sont celles pas encore
  synchronisées (`is_synced: false`)**, mergées par `updated_at`. Les utilisateurs et les entités
  (données de référence : noms, adresses) sont toujours mergés ;
- une fois le pull réussi, stocke `lastUpdateFromServer` (heure serveur) et la `reloadVersion` reçue.

Un rechargement complet donne le même état qu'une nouvelle connexion, plus les lignes locales non
synchronisées. Chaque appareil recharge exactement une fois par demande. Si le pull échoue, ni le
curseur ni la version ne bougent : le pull suivant recharge à nouveau.

`carcassesReloadVersion` est remise à zéro partout où `lastUpdateFromServer` l'est (déconnexion,
changement de version du stockage).

## Rechargement d'un seul utilisateur

`requestCarcassesReload(userId)` (`api-express/src/utils/carcasses-reload.ts`) incrémente
`User.carcasses_reload_version`. Il est appelé :

- après chaque écriture (création, modification, suppression) d'une relation, sans condition, avec
  l'`owner_id` de la relation écrite. **Toute écriture d'une relation
  `CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY` appelle `requestCarcassesReload(owner_id)`.** Les relations
  partenaires (`CAN_TRANSMIT_CARCASSES_TO_ENTITY`) ne changent pas le périmètre des carcasses ;
- par un superadmin, bouton « Recharger ses données » sur la page de l'utilisateur
  (`POST /admin/user/:user_id/carcasses-reload`), quand un seul compte a des données locales fausses :
  pas besoin d'avancer la constante globale.

## Limite connue

Une fiche synchronisée sans carcasse disparaît de l'appareil lors d'un rechargement complet : aucune
route ne la renvoie. Correction prévue côté serveur, dans une autre PR.

## Quand avancer `FORCE_FULL_RELOAD_AFTER`

- Après toute correction de données faite directement en base (script SQL, migration de données),
  dès qu'elle touche des carcasses, des intermédiaires ou des demandes de modification.
- Après un changement des règles de périmètre d'accès (`getCarcasseAccessWhere`), qui peut faire
  sortir des carcasses du périmètre d'un utilisateur.

## Comment

Mettre la date et l'heure du déploiement, en UTC, au format ISO :

```ts
export const FORCE_FULL_RELOAD_AFTER = new Date('2026-10-02T14:30:00.000Z');
```

Utiliser l'heure du déploiement (ou de la correction, si elle est faite après) : un client qui a
pullé avant la correction doit avoir un curseur antérieur à la date. Une date dans le futur force un
rechargement complet à chaque pull jusqu'à cette date.

## Coût

Chaque client actif re-télécharge tout son périmètre (carcasses supprimées comprises) à son prochain
pull, avec les fiches, intermédiaires, demandes de modification, utilisateurs et entités associés.
Le client pagine par 5 000 carcasses : un compte ETG ou SVI avec 50 000 carcasses fait 10 requêtes,
un chasseur en fait le plus souvent une seule. La charge arrive sur le serveur au fil des reconnexions,
pas en une fois.

Pour une correction en place sur quelques carcasses qui restent dans le périmètre, mettre
`updated_at = now()` dans le même script SQL suffit (le `@updatedAt` de Prisma ne joue pas en SQL
brut) : elles repartent dans le delta. Cela ne marche pas pour une carcasse qui sort du périmètre ou
qui est supprimée en dur : il faut alors avancer la constante.
