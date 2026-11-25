# 0035. Observabilité : Sentry, Matomo et données personnelles

## Contexte

Sentry et Matomo reçoivent des URL, des corps de requête et des clics qui peuvent porter des jetons et des données personnelles. Le payload d'une écriture refusée doit pourtant rester rejouable. La taxonomie Matomo est dans [matomo.md](../matomo.md).

## Décision

**Sentry côté API** (`api-express/src/third-parties/sentry.ts`) : seuls les en-têtes utiles sont gardés (`SAFE_HEADERS`) ; de l'utilisateur, seulement l'id. `SENTRY_SCRUB_OPTIONS` est passé à chaque `Sentry.init` : `beforeSend` ne couvre que les erreurs, et les transactions portent aussi body et en-têtes (`beforeSendTransaction`).

**Masquage** :

- `utils/scrub-sensitive.ts` (API et app) : secrets et données personnelles masqués avant Sentry et logs, y compris URL, Referer et paramètres sensibles. Contenu de fichier base64 masqué aussi sous forme JSON (`CONTENU_FICHIER_JSON`). L'ensemble `seen` ne détecte que les cycles.
- `utils/redact-personal-data.ts` : payloads refusés du `/sync` masqués par motif de champ (une liste blanche ferait disparaître tout nouveau champ métier). `*_name_cache` masqué, ids d'entité gardés ; `examinateur_initial_user_id` est le seul id utilisateur conservé (`USER_ID_CONSERVE`, la personne à recontacter). Un champ vide reste vide.
- Les valeurs factices des tests de masquage sont construites à l'exécution (scanners de secrets).

**Erreurs Express** (`api-express/src/middlewares/errors.ts`) : `catchErrors` enveloppe chaque contrôleur async. Code HTTP lu sur `err.status` ou `res.statusCode`. Ne sont pas des erreurs serveur : requête coupée par le client, JSON invalide, body trop gros. Les messages zod des 406 ne sont pas montrés. Pas de `Sentry.Handlers.errorHandler()` (il enverrait chaque 4xx en 500) ; `sendError` capture les vraies erreurs serveur.

**Sentry côté app** (`src/main.tsx`, `src/services/sentry.ts`) : id et rôle seulement. Erreurs ignorées : fetch Firefox pendant une navigation, « TypeError: cancelled » de Safari, bot Outlook SafeLinks. Métriques de performance (TTFB, Network Information API, mémoire) : valeurs filtrables en tags, détail en contexte.

**Matomo côté app** (`src/services/matomo-events.ts`, `matomo.ts`, `MatomoTracker.tsx`) : catalogue catégorie → action → noms autorisés ; jamais de saisie ni de donnée personnelle ; on ne renomme pas un événement. Clics suivis seulement sur `data-matomo` / `matomoClickId`, écoutés en phase de capture. Recherche : une mesure après 500 ms de pause, sans le texte. Paramètres d'URL retirés ; identifiants d'URL remplacés par `:id`. Initialisé en production ou sur activation explicite. Dimensions personnalisées de portée Visit.

**Matomo côté API** (`third-parties/matomo-reporting.ts`, `utils/matomo-stats.ts`) : Matomo répond 200 même en échec (schéma d'erreur) ; toujours en POST avec le token dans le body (tokens « secure only »). Pas de `flat=1` : on lit les sous-tables. Libellés pointant vers la même URL fusionnés (clé date + url). Jetons et emails des URL masqués avant Metabase. Fenêtre glissante J-7 à J-1, calculée à l'heure de Paris ; tout est validé avant la première écriture. Tracking : `e_c` et `e_a` obligatoires, `e_v` numérique.

## Conséquences

- Mettre à jour [matomo.md](../matomo.md) à chaque événement ou `data-matomo` ajouté.
- Un nouveau champ métier qui porte une identité doit être couvert par un motif de `redact-personal-data.ts`.
