# Emails Zacharie

Inventaire de tous les emails qui partent de Zacharie (transactionnels, automatiques, cron, notices internes).

> Objectif : garder la trace de ce qui est branché et de ce qui ne l'est pas, pour toute l'équipe.
> À maintenir à jour quand on ajoute / retire un envoi.

## Architecture d'envoi

Tout passe par **Brevo** — pas de SMTP / nodemailer / autre.

- **`sendEmail()`** — `api-express/src/third-parties/brevo.ts:25`. Sender bas niveau, contenu **inline** (sujet + html/text construits dans le code, wrapper `TransactionalEmailsApi.sendTransacEmail`). Expéditeur par défaut : `Zacharie <contact@zacharie.beta.gouv.fr>`. ⚠️ **Désactivé en dev/test** (log uniquement, pas d'envoi réel).
- **`sendTemplateEmail()`** — `api-express/src/third-parties/brevo.ts`. Envoi via **template Brevo** (sujet + HTML gérés côté dashboard, remplis par `params`). À utiliser pour tout email **migré**. ⚠️ même désactivation dev/test. Refuse un `templateId` absent (Sentry + `false`) : les ids du registre valent `null` tant que le template n'existe pas côté Brevo.
- Les deux senders **avalent leurs erreurs** (remontée Sentry) et renvoient un **booléen de succès**. Tout appelant qui écrit un `NotificationLog` derrière doit le conditionner à ce booléen : ce log porte la dédup, l'écrire après un envoi raté bloquerait le renvoi définitivement.
- **Registre des templates** — `api-express/src/third-parties/brevo-templates.ts`. `BrevoTemplateId` mappe chaque email (clé sémantique) → `templateId` Brevo, ou `null` tant que pas migré. **C'est le tracker de migration** : `null` = encore en texte inline, nombre = migré vers template.
- **`sendNotificationToUser()` / `queueSendNotificationToUser()`** — `api-express/src/service/notifications.ts`. Push web + push natif + email. **L'email ne part que si l'user a activé la préférence `EMAIL`** (`UserNotifications.EMAIL`). Dédup via `NotificationLog` sur `(user_id, type, action)`. Le canal email bascule sur `sendTemplateEmail` dès qu'un `emailTemplateId` est fourni (+ `emailTemplateParams`) ; sinon texte inline. **Migrer un email = lui passer son `emailTemplateId` ici, pas appeler `sendTemplateEmail` directement** : contourner le service fait perdre la dédup, le gating de préférence et le push (les side-effects tournent une fois par carcasse).
- **`sendOnboardingEmailOnce()`** — `api-express/src/utils/send-onboarding-email.ts`. Onboarding, dédup via `NotificationLog` (écrit seulement si l'envoi a réussi), **ignore la préférence EMAIL** (envoie toujours). Tous ses emails sont migrés : il ne prend qu'un `templateId` (+ `params`) et passe par `sendTemplateEmail`.
- **`inviteUser()`** — `api-express/src/utils/invite-user.ts`. Appelle `sendEmail` directement.

---

## 1. Transactionnels (action directe d'un user)

| Déclencheur                                   | Destinataire             | Objet                                                        | Fichier                                                     |
| --------------------------------------------- | ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------- |
| Formulaire de contact (`POST /utils/contact`) | `contact@…` + l'émetteur | `Contact : {prenom} {nom} - {email} - {object}`              | `controllers/utils.ts:34`                                   |
| Demande de reset mot de passe                 | l'user (prod)            | `[Zacharie] Réinitialisation de votre mot de passe`          | `controllers/user.ts:469`                                   |
| Mot de passe changé depuis le profil          | l'user (prod)            | `[Zacharie] Votre mot de passe a été modifié`                | `controllers/user.ts:662`                                   |
| Invitation d'un user (entité / partenaire)    | l'invité                 | `{prenom} {nom} vous a invité à rejoindre Zacharie`          | `utils/invite-user.ts:33`                                   |
| Fin d'onboarding                              | l'user                   | **template Brevo `ONBOARDING_DONE` (id 76)** — sans params   | `controllers/user.ts:1234`                                  |
| Compte activé (user ou admin)                 | l'user                   | **template Brevo `ACCOUNT_ACTIVATED` (id 77)** — param `cta` | `controllers/user.ts:1243`, `controllers/admin/user.ts:290` |

## 2. Notices internes équipe (→ `contact@zacharie.beta.gouv.fr`)

| Déclencheur                                  | Objet                                                          | Fichier                              |
| -------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| Nouvelle ouverture de compte                 | `Nouvelle ouverture de compte pour {email}`                    | `brevo.ts:143,172`                   |
| Inscription finie                            | `Inscription finie pour {email}…`                              | `user.ts:1213`, `admin/user.ts:272`  |
| N° CFEI renseigné/changé après l'inscription | `Numéro CFEI changé pour {email}…`                             | `user.ts:1213` (rien depuis l'admin) |
| Asso de chasse pré-enregistrée               | `Nouvelle association de chasse pré-enregistrée dans Zacharie` | `entite.ts:259`                      |
| Partenaire pré-enregistré                    | `Nouveau partenaire pré-enregistré dans Zacharie`              | `entite.ts:394`                      |
| CCG pré-enregistré                           | `Nouveau CCG pré-enregistré dans Zacharie`                     | `entite.ts:469`                      |

## 3. Notifications automatiques (event-driven, sync FEI/carcasse — email si préf. EMAIL active)

Toutes via `sendNotificationToUser`. Dédup via `NotificationLog`. Déclenchées depuis les side-effects de sync (`controllers/sync.ts`).

| Déclencheur                          | Destinataire                 | Objet                                                                           | Fichier                                           |
| ------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| FEI transmise au SVI                 | users SVI de l'entité        | **template Brevo `FEI_TRANSMITTED_TO_SVI` (id 78)** — le push reste en texte    | `carcasse-side-effects.ts:notifySviAssignment`    |
| FEI attribuée à entité circuit-court | users de l'entité (+ PDF)    | **template `FEI_ASSIGNED_CIRCUIT_COURT` (id 80)** — le push reste en texte      | `carcasse-side-effects.ts:notifyCircuitCourt`     |
| FEI attribuée à un user              | le next-owner                | **template `FEI_ASSIGNED` (id 79)** — le push reste en texte                    | `carcasse-side-effects.ts:notifyNextOwnerUser`    |
| FEI désattribuée (correction)        | l'ex-next-owner              | template `FEI_UNASSIGNED` (pas encore créé → texte inline)                      | `carcasse-side-effects.ts:notifyNextOwnerUser`    |
| FEI attribuée à une entité           | users de l'entité            | **template `FEI_ASSIGNED` (id 79)** — même template que l'attribution à un user | `carcasse-side-effects.ts:notifyNextOwnerEntity`  |
| Saisie SVI (partielle / totale)      | examinateur + 1er détenteur  | `{saisie} {de la carcasse/du lot} de {espèce} n°{bracelet}.`                    | `carcasse-side-effects.ts:31,40`                  |
| Carcasse manquante                   | examinateur + 1er détenteur  | `{La carcasse/Le lot} de {espèce} n°{no} est manquante.`                        | `carcasse-side-effects.ts:31,40`                  |
| Carcasse refusée                     | examinateur + 1er détenteur  | `{La carcasse/Le lot} de {espèce} n°{no} est refusée.`                          | `carcasse-side-effects.ts:31,40`                  |
| FEI clôturée (dernière carcasse)     | examinateur + 1er détenteur  | `La fiche {numero} est clôturée.`                                               | `carcasse-side-effects.ts:161,166`                |
| Fiche renvoyée à l'expéditeur        | l'expéditeur (current-owner) | `La fiche {numero} vous a été renvoyée.`                                        | `carcasse-side-effects.ts:notifyRenvoiExpediteur` |
| Nouvel user dans une entité          | admins de l'entité           | `Un nouvel utilisateur s'est inscrit sur Zacharie au sein de votre entité`      | `user-entity.ts:217`                              |
| Modif carcasse signalée (indicative) | examinateur de la FEI        | `Chasse du {date}` / `Demande de modification`                                  | `sync-carcasse-modification-request.ts:250`       |
| Retour de l'examinateur sur la modif | le demandeur                 | `Carcasse numéro {bracelet}` / `Demande traitée`                                | `sync-carcasse-modification-request.ts:297`       |

## 4. Cron (`npm run start-cronjobs` — prod uniquement, `cronjobs/index.ts`)

| Job                      | Schedule                   | Déclencheur                                         | Objet                                                               | Fichier                              |
| ------------------------ | -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| `automaticClosingOfFeis` | `0 8 * * *` (quotidien 8h) | Carcasses au SVI depuis >10j → clôture auto + notif | `La fiche {numero} est clôturée.`                                   | `cronjobs/feis.ts:173,183`           |
| `relanceProfilIncomplet` | `0 * * * *` (horaire)      | CHASSEUR inscrit il y a 24h–7j, onboarding non fini | **template Brevo `RELANCE_PROFIL_INCOMPLET` (id 86)** — param `cta` | `cronjobs/relance-inscription.ts:48` |

> `automaticClosingOfFeis` early-return en `NODE_ENV=development` (skip notif).

## ⚠️ Pas branché / mort

- **Trichine** (`utils/trichine.ts:253`) — `queueSendNotificationToUser` **commenté**. Écrit seulement dans la table `trichineNotification` + `console.log`. **Aucun email.** (feature en cours)
- `cronjobs/index.ts:38-41` — `initMunicipalities` / `initRecommandations` / `initAggregators` / `initNotifications` commentés.

## Pas des emails (canaux liés mais distincts)

- **`sendWebhook()`** (`utils/api.ts`) — webhooks HTTP vers tiers (`FEI_CLOTUREE`, `FEI_ASSIGNEE_*`…). Souvent envoyé en parallèle des notifs ci-dessus.
- **Web-push / native-push** dans `sendNotificationToUser` — canal séparé, gated sur préf. `PUSH`.
  Le web-push passe par `web-push` (VAPID), le natif par l'API push d'Expo (`third-parties/expo-push.ts`, tokens `User.native_push_tokens`). Les deux partagent la même dédup `NotificationLog` de type `PUSH`.
  Le natif n'envoie qu'en production (hors dev/test/preprod, comme Brevo), et **est actuellement coupé par l'interrupteur `NATIVE_PUSH_DRY_RUN` (`config.ts`)**, le temps de vérifier le contenu des notifications : le payload est loggé, rien n'est envoyé et aucun `NotificationLog` n'est écrit. Le repasser à `false` réactive l'envoi.
  Les tokens qui ne sont pas au format `ExponentPushToken[…]` sont écartés avant l'appel (Expo rejette la requête entière si un seul `to` est invalide), et retirés de l'utilisateur — comme ceux qu'Expo signale `DeviceNotRegistered`.
- **Sync CRM Brevo** (`createBrevoContact`, `updateBrevoContact`, `updateOrCreateBrevoCompany`, `updateBrevoChasseurDeal`…) — appels API CRM, pas des emails transactionnels (mais `createBrevoContact` déclenche la notice interne « Nouvelle ouverture de compte »).
