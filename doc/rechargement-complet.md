# Rechargement complet des données locales

Deux dates déclenchent un rechargement complet du périmètre de carcasses d'un appareil :

- `FORCE_FULL_RELOAD_AFTER` (`api-express/src/utils/force-full-reload.ts`) : pour tous les utilisateurs ;
- `User.carcasses_reload_requested_at` : pour un seul utilisateur, sur tous ses appareils.

Le serveur prend la plus récente des deux (`getFullReloadAfter`, `api-express/src/utils/carcasses-reload.ts`).

## Pourquoi

Le pull delta (`GET /carcasse?after=<lastUpdateFromServer>`) ne renvoie que les carcasses du périmètre
de l'utilisateur modifiées depuis son dernier pull. Une carcasse qui sort du périmètre, ou qui est
corrigée en base sans que son `updated_at` bouge, n'est jamais renvoyée : la copie locale reste figée.

## Ce que fait la constante

- Serveur (`api-express/src/controllers/carcasse.ts`) : si le curseur `after` du client est antérieur
  à cette date, le filtre `updated_at` est ignoré, tout le périmètre est renvoyé et la
  réponse porte `fullReload: true`. Un premier chargement (`after = 0`) renvoie aussi tout le
  périmètre, mais avec `fullReload: false`.
- Client (`app-local-first-react-router/src/utils/load-carcasses.ts`) : sur `fullReload`, toutes les
  données locales sont remplacées par la réponse : fiches, carcasses, `CarcasseIntermediaire`,
  demandes de modification, utilisateurs et entités. Restent seulement les copies locales non
  synchronisées (`is_synced: false`), mergées par `updated_at`, et les utilisateurs / entités des
  relations de l'utilisateur (chargés par `load-my-relations`).
- Une fois le rechargement fait, `lastUpdateFromServer` passe à l'heure serveur, postérieure à la
  date : le client repasse en delta. Chaque appareil recharge une fois, sans accusé de réception.
  Si le chargement échoue, le curseur ne bouge pas et le pull suivant recharge à nouveau.

## Rechargement d'un seul utilisateur

`User.carcasses_reload_requested_at` est posé :

- par `requestCarcassesReloadIfAccessChanged()`, à chaque création / modification / suppression d'une
  `EntityAndUserRelations` qui fait entrer ou sortir l'utilisateur d'une entité (relation
  `CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY`, statut `ADMIN` ou `MEMBER`). Sans ça, les carcasses déjà
  existantes d'une entité rejointe n'arrivent jamais (leur `updated_at` ne bouge pas), et celles d'une
  entité quittée restent sur l'appareil. **Toute nouvelle écriture de `EntityAndUserRelations` doit
  appeler ce helper.**
- par un superadmin, bouton « Recharger ses données » sur la page de l'utilisateur
  (`POST /admin/user/:user_id/carcasses-reload`), quand un seul compte a des données locales fausses :
  pas besoin d'avancer la constante globale.

## Quand l'avancer

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
