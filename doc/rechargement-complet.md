# Rechargement complet des données locales

`FORCE_FULL_RELOAD_AFTER` (`api-express/src/utils/force-full-reload.ts`) est le seul moyen de forcer
tous les clients à re-télécharger leur périmètre de carcasses.

## Pourquoi

Le pull delta (`GET /carcasse?after=<lastUpdateFromServer>`) ne renvoie que les carcasses du périmètre
de l'utilisateur modifiées depuis son dernier pull. Une carcasse qui sort du périmètre, ou qui est
corrigée en base sans que son `updated_at` bouge, n'est jamais renvoyée : la copie locale reste figée.

## Ce que fait la constante

- Serveur (`api-express/src/controllers/carcasse.ts`) : si le curseur `after` du client est antérieur
  à `FORCE_FULL_RELOAD_AFTER`, le filtre `updated_at` est ignoré, tout le périmètre est renvoyé et la
  réponse porte `fullReload: true`. Un premier chargement (`after = 0`) renvoie aussi tout le
  périmètre, mais avec `fullReload: false`.
- Client (`app-local-first-react-router/src/utils/load-carcasses.ts`) : sur `fullReload`, les
  carcasses, les `CarcasseIntermediaire` et les demandes de modification locales sont remplacées par
  la réponse. Seules les copies locales non synchronisées (`is_synced: false`) sont conservées, puis
  mergées par `updated_at`. Les fiches, les utilisateurs et les entités ne sont pas remplacés : ils
  sont mergés (les entités déjà présentes ne sont pas écrasées).
- Une fois le rechargement fait, `lastUpdateFromServer` passe à l'heure serveur : le client repasse
  en delta.

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
