# Suivi d'usage Matomo

Ce que Zacharie envoie à Matomo, et comment nommer un nouvel événement.

Code : `app-local-first-react-router/src/services/matomo.ts` (envoi) et `src/services/matomo-events.ts` (catalogue des événements métier, source de vérité).
Matomo n'envoie rien hors production : en dev, chaque événement s'affiche dans la console (`[Matomo] Event: …`).

## Trois types de mesures

| Type                  | Comment                                                              | Exemple dans Matomo                                                   |
| --------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Pages vues**        | automatiques, à chaque changement d'URL (`MatomoTracker.tsx`)        | `/app/chasseur/fei/ZACH-…`                                            |
| **Événements métier** | `track(catégorie, action, nom?, valeur?)`, typé par le catalogue     | `fiche / creer / liste-vide`                                          |
| **Clics**             | tout élément portant `data-matomo="<id>"` est compté automatiquement | `clic / fiche-voir-toutes-les-fiches / /app/chasseur/fei/:id/envoyée` |

## Dimensions personnalisées

À créer dans Matomo (Administration → Mesurer → Dimensions personnalisées). L'id Matomo doit correspondre à la constante dans `matomo.ts`.

| Id  | Nom       | Portée | Valeurs                                |
| --- | --------- | ------ | -------------------------------------- |
| 1   | Connexion | Visite | `connecté`, `non connecté`             |
| 2   | Admin     | Visite | `admin`, `non admin`                   |
| 3   | Rôle      | Visite | `CHASSEUR`, `ETG`, `SVI`, … ou `aucun` |

Le rôle est porté par une dimension, **jamais par le nom de l'événement** : `fiche / transmettre` reste le même événement quel que soit l'acteur.

## Règles de nommage des événements métier

| Champ     | Règle                                   | Exemples                                                  |
| --------- | --------------------------------------- | --------------------------------------------------------- |
| Catégorie | objet métier, au singulier              | `fiche`, `carcasse`, `vente-don`, `ccg`, `partenaire`     |
| Action    | verbe à l'infinitif                     | `creer`, `ajouter`, `supprimer`, `transmettre`, `bloquer` |
| Nom       | contexte pris dans une **liste fermée** | `liste-vide`, `heure-prelevement`, `avec-anomalie`        |
| Valeur    | un nombre                               | nombre de carcasses, d'anomalies                          |

- Tout en minuscules, kebab-case, sans accent (vérifié par `matomo.test.ts`).
- **Jamais de donnée personnelle ni de saisie libre** : pas de nom, d'email, de numéro de fiche ou de bracelet, de texte de recherche.
- **Jamais de jeton ni d'email dans une URL trackée.** `MatomoTracker.tsx` passe l'URL des pages vues dans `scrubString` (`utils/scrub-sensitive.ts`) : tout paramètre dont le nom contient `token`, `password`, `secret`, `key` ou `email` est envoyé sous la forme `[masqué]`. Les paramètres `reset-password-token`, `invitation-token` et `email` sont aussi à déclarer dans Matomo (Administration → Sites web → Gérer → « Paramètres d'URL à exclure »), qui les retire dès la collecte.
- `bloquer` = l'utilisateur a tenté une action et a été arrêté par une validation. Le nom dit pourquoi (premier motif rencontré).

## Faire évoluer la taxonomie

- **Ajouter** un événement : l'ajouter dans `matomo-events.ts` puis l'appeler avec `track(...)`. TypeScript refuse toute combinaison absente du catalogue.
- **Ne jamais renommer** un événement existant : l'historique Matomo serait coupé en deux. Créer le nouveau, retirer l'ancien du code, et le noter dans le journal ci-dessous.
- Un événement suit une **action métier**, pas un bouton. Quand plusieurs boutons mènent à la même action (ex. 8 façons de créer une fiche), on déclenche l'événement dans la fonction métier (`createNewFei`) et le bouton devient le `nom`.
- Pour un bouton sans action métier (navigation, ouverture de modale) : ajouter `data-matomo="<objet>-<verbe>-<complément>"`. Sur les composants DSFR (`linkProps`, `nativeButtonProps`) : `...matomoClickId('<id>')`. Le libellé visible n'est jamais envoyé, car il peut contenir un nom de personne.

## Catalogue actuel

### Création et transmission de fiche (chasseur)

| Catégorie / action                     | Noms                                                                                                                                                                                                             | Valeur          | Déclenché quand                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| `fiche / creer`                        | `bouton-flottant`, `barre-navigation`, `liste-mobile`, `liste-bureau`, `liste-vide`, `tableau-de-bord-vide`, `apres-envoi`, `lien-direct`                                                                        | —               | une fiche est créée, nom = d'où                                                                   |
| `fiche / designer-premier-detenteur`   | `moi`, `association`, `autre-utilisateur`                                                                                                                                                                        | —               | « Continuer » du bloc Informations de chasse                                                      |
| `carcasse / ajouter`                   | `grand-gibier`, `petit-gibier`                                                                                                                                                                                   | nb d'anomalies  | une carcasse ou un lot est ajouté                                                                 |
| `carcasse / bloquer`                   | `numero-bracelet-manquant`, `espece-manquante`, `numero-bracelet-deja-utilise`                                                                                                                                   | —               | ajout de carcasse refusé                                                                          |
| `carcasse / modifier-anomalie`         | `ajout`, `retrait`                                                                                                                                                                                               | —               | anomalie modifiée sur une carcasse existante                                                      |
| `carcasse / supprimer`                 | —                                                                                                                                                                                                                | —               | carcasse supprimée                                                                                |
| `anomalie / ouvrir-selecteur`          | `grand-gibier`, `petit-gibier`                                                                                                                                                                                   | —               | ouverture du sélecteur d'anomalies (ajout ou modification de carcasse)                            |
| `anomalie / selectionner`              | `liste`, `recherche`                                                                                                                                                                                             | —               | anomalie du référentiel cochée, nom = depuis la liste d'une famille ou les résultats de recherche |
| `anomalie / retirer`                   | `liste`, `recherche`, `pastille`, `saisie-libre`                                                                                                                                                                 | —               | anomalie décochée                                                                                 |
| `anomalie / rechercher`                | `resultat-trouve`, `resultat-vide`                                                                                                                                                                               | —               | recherche terminée (1,5 s sans frappe) ; le texte n'est jamais envoyé                             |
| `anomalie / saisir-libre`              | `famille`, `hors-famille`, `recherche-vide`                                                                                                                                                                      | —               | anomalie hors référentiel ajoutée ; le texte n'est jamais envoyé                                  |
| `anomalie / agrandir-photo`            | —                                                                                                                                                                                                                | —               | photo d'une anomalie ouverte en grand                                                             |
| `fiche / confirmer-examen`             | `avec-anomalie`, `sans-anomalie`                                                                                                                                                                                 | —               | « Continuer » après la liste des carcasses                                                        |
| `fiche / valider-examen`               | `avec-anomalie`, `sans-anomalie`                                                                                                                                                                                 | —               | case de certification cochée                                                                      |
| `vente-don / enregistrer`              | `usage-domestique`, `destinataire`                                                                                                                                                                               | —               | vente ou don enregistré dans la modale                                                            |
| `vente-don / bloquer`                  | `destinataire`, `carcasses`, `stockage`, `transport`                                                                                                                                                             | —               | étape de la modale incomplète                                                                     |
| `vente-don / supprimer`                | —                                                                                                                                                                                                                | —               | vente ou don retiré avant envoi                                                                   |
| `fiche / bloquer`                      | `date-mise-a-mort`, `commune`, `premier-detenteur`, `heure-prelevement`, `heure-evisceration`, `aucune-carcasse`, `carcasse-incomplete`, `date-validation-examen`, `certification`, `vente-don`, `lien-invalide` | —               | transmission refusée, nom = premier champ manquant                                                |
| `fiche / transmettre`                  | `premier-detenteur`, `destinataire`                                                                                                                                                                              | nb de carcasses | fiche transmise                                                                                   |
| `fiche / quitter`                      | —                                                                                                                                                                                                                | —               | « Retour » sur une fiche pas encore entièrement transmise                                         |
| `fiche / supprimer`                    | —                                                                                                                                                                                                                | —               | fiche supprimée                                                                                   |
| `ccg / creer`                          | `numero-existant`, `nouvelle`                                                                                                                                                                                    | —               | chambre froide ajoutée depuis la fiche                                                            |
| `partenaire / creer`                   | —                                                                                                                                                                                                                | —               | destinataire ajouté depuis la fiche                                                               |
| `assistant-zacharie / ouvrir`          | —                                                                                                                                                                                                                | —               | assistant de saisie ouvert (easter egg « zacharie » tapé sur la fiche)                            |
| `assistant-zacharie / envoyer-message` | —                                                                                                                                                                                                                | —               | message envoyé à l'assistant de saisie de la fiche                                                |
| `assistant-zacharie / dicter`          | —                                                                                                                                                                                                                | —               | dictée lancée avec le bouton micro de l'assistant                                                 |

### Laboratoire (trichine)

| Catégorie / action       | Noms                                                                                        | Valeur                 | Déclenché quand                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `laboratoire / exporter` | `pools-csv`, `pools-json`, `echantillons-csv`, `echantillons-json`, `ftps-csv`, `ftps-json` | nb de lignes exportées | export d'un registre (lignes cochées, sinon lignes affichées) pour le LIMS |

### Clics annotés (`data-matomo`)

| Id                                    | Où                             |
| ------------------------------------- | ------------------------------ |
| `carcasse-ouvrir-ajout`               | carte « Ajouter une carcasse » |
| `fiche-attribuer-carcasses-restantes` | page de confirmation d'envoi   |
| `fiche-voir-toutes-les-fiches`        | page de confirmation d'envoi   |

### Événements antérieurs à cette taxonomie

Gardés tels quels pour ne pas couper leur historique : `landing / …`, `Quiz / …`, `QuizTv / view`, `registre-* / …`, `fiches-chasseur / …`, `header-recherche / …`, `export / …`, `onboarding / skip`, `error / 404`. Ils passent par `trackEvent` / `trackFeature`, pas par le catalogue.

## Export vers Metabase

Matomo est hébergé sur l'instance mutualisée `stats.beta.gouv.fr` : on n'a pas accès à sa base, seulement à l'API Reporting. Le cron `Import statistiques Matomo` (`api-express/src/cronjobs/matomo-stats.ts`) lit cette API et écrit dans notre Postgres, que Metabase lit déjà.

| Table                    | Rapport Matomo                                     | Clé                          |
| ------------------------ | -------------------------------------------------- | ---------------------------- |
| `matomo_visits_daily`    | `VisitsSummary.get`                                | `date`                       |
| `matomo_pages_daily`     | `Actions.getPageUrls` (aplati)                     | `date`, `url`                |
| `matomo_events_daily`    | `Events.getCategory` × `eventAction` (sous-tables) | `date`, `category`, `action` |
| `matomo_referrers_daily` | `Referrers.getReferrerType` (libellés en français) | `date`, `referrer_type`      |

- `date` est un jour dans le fuseau du site Matomo (Europe/Paris). `synced_at` dit quand la ligne a été écrite pour la dernière fois.
- `bounce_rate` est en pourcentage (`15` = 15 %), les durées sont en secondes.
- Une page sans URL (la ligne « Autres » que Matomo crée quand un rapport est tronqué) est rangée sous son libellé.
- Les URL et libellés de pages passent dans `scrubString` avant l'écriture : les jetons et emails déjà stockés dans Matomo (avant le masquage côté front) n'arrivent pas dans la base lue par Metabase. Les URL qui ne différaient que par un jeton sont fusionnées en une seule ligne.

### Déclenchement

Tous les jours à 6h15 (Europe/Paris), dans le process `npm run start-cronjobs`. Le cron réimporte J-7 → J-1, parce que Matomo peut consolider une journée tardivement. L'écriture est un upsert : relancer sur une période déjà importée réécrit les mêmes lignes. Le log donne le nombre de lignes écrites par table et la durée. Une erreur part dans Sentry.

Sans `MATOMO_TOKEN`, le cron n'est pas lancé.

### Variables d'environnement (app cronjobs)

| Variable         | Valeur                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `MATOMO_URL`     | `https://stats.beta.gouv.fr` (valeur par défaut)                    |
| `MATOMO_TOKEN`   | token d'API d'un compte qui a l'accès `view` sur le site            |
| `MATOMO_SITE_ID` | id du site Zacharie dans Matomo (le même que `VITE_MATOMO_SITE_ID`) |

### Obtenir le token

1. Avoir un compte sur `stats.beta.gouv.fr` avec au moins l'accès `view` sur le site Zacharie. Sinon, le demander à un administrateur du site dans Matomo.
2. Dans Matomo : Administration → Personnel → Sécurité → **Tokens d'authentification** → « Créer un nouveau token ».
3. Cocher « Uniquement les requêtes POST sécurisées » : le client envoie toujours le token en POST, dans le body.
4. Poser la valeur dans `MATOMO_TOKEN` sur l'app cronjobs (Clever Cloud) et redémarrer.

### Import de l'historique

À lancer une fois après la mise en place, ou pour combler un trou. L'import se fait par tranches d'un mois et peut être relancé sans risque.

```bash
cd api-express
MATOMO_TOKEN=... MATOMO_SITE_ID=... POSTGRESQL_ADDON_URI=postgres://... \
  npm run matomo-backfill -- --from 2025-01-01 --to 2026-10-20
```

## Limite connue

Un événement déclenché hors ligne est perdu : le tracker Matomo n'a pas de file d'attente. Une file locale, vidée au retour du réseau, est prévue dans un second temps.

## Journal des changements

- 2026-10 : création de la taxonomie, parcours de création de fiche chasseur, dimension Rôle.
- 2026-10 : export quotidien des statistiques Matomo vers Postgres pour Metabase.
- 2026-10 : les jetons et emails en paramètre d'URL sont masqués avant l'envoi à Matomo.
