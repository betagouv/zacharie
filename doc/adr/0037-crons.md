# 0037. Crons : verrou, data health, clôture automatique et relances

## Contexte

Plusieurs instances de l'API tournent en production. En local-first, le backend reçoit des deltas déjà décidés, souvent dans le désordre : certaines incohérences sont valides ligne par ligne mais fausses globalement. Les crons ne tournent qu'en production (voir CLAUDE.md).

## Décision

**Lancement** (`api-express/src/cronjobs/utils.ts`, `index.ts`) : la table `CronJob` sert de verrou (contrainte unique sur `unique_key`) ; un cron en cours n'est pas relancé. Fuseau Europe/Paris. Crons initialisés l'un après l'autre (logs lisibles). En local, ils ne font rien ; le script manuel passe `force`.

**Data health** (`cronjobs/data-health.ts`, 6h00) : balaie l'état global à froid, en lecture seule, et signale à Sentry sans jamais réparer (une réparation entrerait en course avec un delta client en vol). Chaque check doit tendre vers 0 ; sinon corriger à la source ou exclure explicitement le cas. Compte + échantillon de 20 ids, en deux requêtes. Tester avec `npm run dev-cronjobs`. Checks :

- examinateur initial avec une entité (`scripts/20260803_cloture_fiches.sql`) : la fiche bascule en « à compléter » chez l'aval ;
- plusieurs rôles par utilisateur : contrôle backend ultime de la règle « un rôle par utilisateur » ;
- `owner_role` sans owner : carcasse invisible des deux côtés ;
- rôle-entité (ETG, SVI, COLLECTEUR_PRO) sans `entity_id` (`ROLES_REQUIRING_ENTITY` ; PREMIER_DETENTEUR et circuit court exclus, portés par un utilisateur ou une entité) ;
- `owner_role` incohérent avec `Entity.type`, sauf COLLECTEUR_PRO sur une entité CCG, et COLLECTEUR_PRO sur une entité ETG (transport amont, transitoire jusqu'à la confirmation par un salarié RECEPTION) ;
- examinateur dont l'owner n'est pas CHASSEUR ;
- prise en charge orpheline : détenue par un ETG ou collecteur sans `CarcasseIntermediaire` (pas de bouton « Prendre en charge », pas de section de transmission), carcasses encore vivantes seulement.

**Clôture automatique** (`cronjobs/feis.ts`, 8h00, après le data health) : chaque carcasse assignée au SVI depuis plus de 10 jours (début de journée) est clôturée. Une demande de modification en cours ne la retient pas. Un sanglier attend un résultat trichine négatif (§6.2 de [trichine.md](../trichine.md)). La fiche est close et examinateur / premier détenteur notifiés seulement si toutes ses carcasses sont terminales ; regroupement par (fiche, destinataire du premier détenteur, éventuellement null) ; une transmission en erreur n'empêche pas les suivantes.

**Matomo** (`cronjobs/matomo-stats.ts`, 6h15) : import des statistiques dans Postgres pour Metabase, upsert idempotent de J-7 à J-1 (voir [0035](0035-observabilite-sentry-matomo-donnees-personnelles.md)).

**Relance d'inscription** (`cronjobs/relance-inscription.ts`, toutes les heures) : relance unique des chasseurs sans `onboarded_at`, 24 h après la création, bornée à 7 jours pour ne pas relancer le backlog au déploiement.

## Conséquences

- Un check data health qui ne tend pas vers 0 crée de la fatigue d'alerte : le corriger ou l'exclure.
- Les crons qui envoient des emails sont listés dans [emails.md](../emails.md).
