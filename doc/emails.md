# Emails Zacharie

Inventaire de tous les emails qui partent de Zacharie (transactionnels, automatiques, cron, notices internes).

> Objectif : garder la trace de ce qui est branché et de ce qui ne l'est pas, pour toute l'équipe.
> À maintenir à jour quand on ajoute / retire un envoi.

## Architecture d'envoi

Tout passe par **Brevo** — pas de SMTP / nodemailer / autre.

- **`sendEmail()`** — `api-express/src/third-parties/brevo.ts:25`. Sender bas niveau, contenu **inline** (sujet + html/text construits dans le code, wrapper `TransactionalEmailsApi.sendTransacEmail`). Expéditeur par défaut : `Zacharie <contact@zacharie.beta.gouv.fr>`. ⚠️ **Désactivé en dev/test** (log uniquement, pas d'envoi réel).
- **`sendTemplateEmail()`** — `api-express/src/third-parties/brevo.ts`. Envoi via **template Brevo** (sujet + HTML gérés côté dashboard, remplis par `params`). À utiliser pour tout email **migré**. ⚠️ même désactivation dev/test.
- **Registre des templates** — `api-express/src/third-parties/brevo-templates.ts`. `BrevoTemplateId` mappe chaque email (clé sémantique) → `templateId` Brevo, ou `null` tant que pas migré. **C'est le tracker de migration** : `null` = encore en texte inline, nombre = migré vers template.
- **`sendNotificationToUser()` / `queueSendNotificationToUser()`** — `api-express/src/service/notifications.ts`. Orchestrateur qui lance **deux canaux distincts en parallèle** : `sendPushToUser()` (push web+natif, gated préf. `PUSH`) et `sendEmailToUser()` (email, gated préf. `EMAIL`). Chacun déduplique indépendamment via `NotificationLog` sur `(user_id, type, action)`. L'email reste en texte inline (migration template progressive).
- **`sendOnboardingEmailOnce()`** — `api-express/src/utils/send-onboarding-email.ts`. Onboarding, dédup via `NotificationLog`, **ignore la préférence EMAIL** (envoie toujours).
- **`inviteUser()`** — `api-express/src/utils/invite-user.ts`. Appelle `sendEmail` directement.

---

## 1. Transactionnels (action directe d'un user)

| Déclencheur                                   | Destinataire             | Objet                                                                | Fichier                                                     |
| --------------------------------------------- | ------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| Formulaire de contact (`POST /utils/contact`) | `contact@…` + l'émetteur | `Contact : {prenom} {nom} - {email} - {object}`                      | `controllers/utils.ts:34`                                   |
| Demande de reset mot de passe                 | l'user (prod)            | `[Zacharie] Réinitialisation de votre mot de passe`                  | `controllers/user.ts:469`                                   |
| Invitation d'un user (entité / partenaire)    | l'invité                 | `{prenom} {nom} vous a invité à rejoindre Zacharie`                  | `utils/invite-user.ts:33`                                   |
| Fin d'onboarding                              | l'user                   | `Votre inscription sur Zacharie (fiches d'examen initial du gibier)` | `controllers/user.ts:1154`                                  |
| Compte activé (user ou admin)                 | l'user                   | `Votre compte Zacharie a été activé`                                 | `controllers/user.ts:1167`, `controllers/admin/user.ts:292` |

## 2. Notices internes équipe (→ `contact@zacharie.beta.gouv.fr`)

| Déclencheur                        | Objet                                                                  | Fichier                             |
| ---------------------------------- | ---------------------------------------------------------------------- | ----------------------------------- |
| Nouvelle ouverture de compte       | `Nouvelle ouverture de compte pour {email}`                            | `brevo.ts:143,172`                  |
| Inscription finie / n° CFEI changé | `Inscription finie pour {email}…` / `Numéro CFEI changé pour {email}…` | `user.ts:1132`, `admin/user.ts:273` |
| Asso de chasse pré-enregistrée     | `Nouvelle association de chasse pré-enregistrée dans Zacharie`         | `entite.ts:259`                     |
| Partenaire pré-enregistré          | `Nouveau partenaire pré-enregistré dans Zacharie`                      | `entite.ts:394`                     |
| CCG pré-enregistré                 | `Nouveau CCG pré-enregistré dans Zacharie`                             | `entite.ts:469`                     |

## 3. Notifications automatiques (event-driven, sync FEI/carcasse — email si préf. EMAIL active)

Toutes via `sendNotificationToUser`. Dédup via `NotificationLog`. Déclenchées depuis les side-effects de sync (`controllers/sync.ts`).

| Déclencheur                          | Destinataire                | Objet                                                                                             | Fichier                                     |
| ------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| FEI transmise au SVI                 | users SVI de l'entité       | `L'établissement {nom} vous a transmis une fiche comprenant {n} carcasses (ou lots) à inspecter:` | `fei-side-effects.ts:137`                   |
| FEI attribuée à entité circuit-court | users de l'entité (+ PDF)   | `{prenom} {nom} vous a attribué une fiche d'examen initial du gibier sauvage n° {numero}`         | `fei-side-effects.ts:228`                   |
| FEI attribuée à un user              | le next-owner               | `{prenom} {nom} vous a attribué la fiche {numero}`                                                | `fei-side-effects.ts:305`                   |
| FEI désattribuée (correction)        | l'ex-next-owner             | `La fiche n° {numero} ne vous est plus attribuée`                                                 | `fei-side-effects.ts:327`                   |
| FEI attribuée à une entité           | users de l'entité           | `{prenom} {nom} vous a attribué la fiche {numero}`                                                | `fei-side-effects.ts:390`                   |
| Saisie SVI (partielle / totale)      | examinateur + 1er détenteur | `{saisie} {de la carcasse/du lot} de {espèce} n°{bracelet}.`                                      | `carcasse-side-effects.ts:31,40`            |
| Carcasse manquante                   | examinateur + 1er détenteur | `{La carcasse/Le lot} de {espèce} n°{no} est manquante.`                                          | `carcasse-side-effects.ts:31,40`            |
| Carcasse refusée                     | examinateur + 1er détenteur | `{La carcasse/Le lot} de {espèce} n°{no} est refusée.`                                            | `carcasse-side-effects.ts:31,40`            |
| FEI clôturée (dernière carcasse)     | examinateur + 1er détenteur | `La fiche {numero} est clôturée.`                                                                 | `carcasse-side-effects.ts:161,166`          |
| Nouvel user dans une entité          | admins de l'entité          | `Un nouvel utilisateur s'est inscrit sur Zacharie au sein de votre entité`                        | `user-entity.ts:217`                        |
| Demande de modif carcasse créée      | examinateur de la FEI       | `Chasse du {date}` / `Demande de modification`                                                    | `sync-carcasse-modification-request.ts:203` |
| Demande de modif traitée             | le demandeur                | `Carcasse numéro {bracelet}` / `Demande traitée`                                                  | `sync-carcasse-modification-request.ts:239` |

## 4. Cron (`npm run start-cronjobs` — prod uniquement, `cronjobs/index.ts`)

| Job                      | Schedule                   | Déclencheur                                         | Objet                                                                | Fichier                              |
| ------------------------ | -------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| `automaticClosingOfFeis` | `0 8 * * *` (quotidien 8h) | Carcasses au SVI depuis >10j → clôture auto + notif | `La fiche {numero} est clôturée.`                                    | `cronjobs/feis.ts:173,183`           |
| `relanceProfilIncomplet` | `0 * * * *` (horaire)      | CHASSEUR inscrit il y a 24h–7j, onboarding non fini | `Votre inscription sur Zacharie (fiches d'examen initial du gibier)` | `cronjobs/relance-inscription.ts:50` |

> `automaticClosingOfFeis` early-return en `NODE_ENV=development` (skip notif).

## ⚠️ Pas branché / mort

- **Trichine** (`utils/trichine.ts:253`) — `queueSendNotificationToUser` **commenté**. Écrit seulement dans la table `trichineNotification` + `console.log`. **Aucun email.** (feature en cours)
- `controllers/user.ts:820` — bloc `sendNotificationToUser` commenté.
- `cronjobs/index.ts:38-41` — `initMunicipalities` / `initRecommandations` / `initAggregators` / `initNotifications` commentés.

## Pas des emails (canaux liés mais distincts)

- **`sendWebhook()`** (`utils/api.ts`) — webhooks HTTP vers tiers (`FEI_CLOTUREE`, `FEI_ASSIGNEE_*`…). Souvent envoyé en parallèle des notifs ci-dessus.
- **Web-push / native-push** dans `sendNotificationToUser` — canal séparé, gated sur préf. `PUSH`.
- **Sync CRM Brevo** (`createBrevoContact`, `updateBrevoContact`, `updateOrCreateBrevoCompany`, `updateBrevoChasseurDeal`…) — appels API CRM, pas des emails transactionnels (mais `createBrevoContact` déclenche la notice interne « Nouvelle ouverture de compte »).
