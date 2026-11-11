# Rechargement complet des données locales

Trois déclencheurs forcent un rechargement complet du périmètre de carcasses d'un appareil :

- la date `FORCE_FULL_RELOAD_AFTER` (`api-express/src/utils/force-full-reload.ts`) : pour tous les
  utilisateurs ;
- le compteur `User.carcasses_reload_version` : pour un seul utilisateur, sur tous ses appareils ;
- le contrôle d'intégrité du client (`checkLocalCarcassesIntegrity`,
  `app-local-first-react-router/src/utils/load-carcasses.ts`, au plus toutes les 6 heures) : si le
  nombre de carcasses synchronisées du store diffère de `GET /carcasse/count`, l'appareil envoie
  `reloadVersion=-1` à son pull suivant. Cas typique : une carcasse sortie du périmètre (renvoi fait
  sur un autre appareil, destinataire changé par l'expéditeur) que le delta ne retire jamais.

Hors contrôle d'intégrité, le serveur décide, le client obéit : il ne compare jamais lui-même les dates
ni les versions.

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

- après chaque écriture (création, modification, suppression) d'une relation, avec l'`owner_id` de
  la relation écrite. **Toute écriture d'une relation `CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY` doit
  appeler `requestCarcassesReload(owner_id)`.** L'appel est fait sans condition sur le type ni sur le
  statut de la relation : une relation partenaire (`CAN_TRANSMIT_CARCASSES_TO_ENTITY`) ou une demande
  de rattachement en attente déclenche aussi un rechargement, alors qu'elle ne change pas le
  périmètre. Coût accepté : un rechargement de trop, jamais une donnée fausse.
  Exceptions : la relation créée avec une entité neuve (création d'une association de chasse,
  pré-enregistrement d'un destinataire) ou pour un compte neuf (invitation d'un nouveau membre) :
  l'entité n'a encore aucune fiche, ou le compte n'a encore aucun appareil ;
- par un superadmin, bouton « Recharger ses données » sur la page de l'utilisateur
  (`POST /admin/user/:user_id/carcasses-reload`), quand un seul compte a des données locales fausses :
  pas besoin d'avancer la constante globale.

## Limites connues

- **Pas de transaction.** L'écriture de la relation et l'incrément de la version sont deux requêtes
  séparées. Si l'incrément échoue après l'écriture, aucun rechargement n'a lieu et rien ne le relance.
  Correction : bouton superadmin « Recharger ses données ».
- **Version qui change pendant un chargement paginé.** Le client lit `fullReload` et `reloadVersion`
  sur la page 0 seulement. Si la version augmente entre la page 0 (delta) et une page suivante, cette
  page est calculée sans filtre `updated_at`, avec le même décalage : le résultat de ce pull est
  incomplet. Le client stocke la version de la page 0, donc le pull suivant recharge tout et corrige.
- **Fiche sans carcasse.** Le périmètre se lit sur les carcasses. Une fiche synchronisée sans carcasse
  n'est renvoyée qu'à son créateur et à son examinateur initial. Pour les autres utilisateurs (premier
  détenteur, par exemple), elle disparaît de l'appareil lors d'un rechargement complet.

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
`updated_at = clock_timestamp()` et `version = version + 1` dans le même script SQL suffit (le
`@updatedAt` de Prisma ne joue pas en SQL brut) : elles repartent dans le delta. Pas `now()` : il
renvoie l'heure du début de la transaction, et un client qui pull entre ce début et le `COMMIT` ne
verra jamais la correction. Faire le `COMMIT` tout de suite après l'`UPDATE`. Cela ne marche pas pour une carcasse qui sort du périmètre ou
qui est supprimée en dur : il faut alors avancer la constante.
