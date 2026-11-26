# 0029. Notifications : email, push web et push natif

## Contexte

Zacharie notifie par email (Brevo), push web et push natif (Expo). Les side-effects tournent une fois par carcasse alors qu'une notification couvre souvent la fiche. L'inventaire des emails est dans [emails.md](../emails.md) (à tenir à jour, voir `api-express/CLAUDE.md`).

## Décision

**Canaux et dédup** (`api-express/src/service/notifications.ts`) :

- Push et email sont indépendants : l'échec de l'un n'empêche pas l'autre et ne remonte pas aux appelants. Dédup par canal via `NotificationLog` (push web et natif partagent le type `PUSH`). Un envoi raté n'écrit pas de log, sinon la dédup bloquerait le renvoi pour toujours. On attend l'envoi de l'email avant de rendre la main (la tâche PQueue suivante fait son `findFirst`). File `concurrency: 1`.
- `SENT` porte l'id Brevo (null en test) ; `SKIPPED` = email désactivé ou déjà envoyé. Les `cc` suivent l'email du destinataire.
- Push : wording dédié (`PushWording`), titre générique, une phrase, ni « Bonjour » ni URL ; `url` = chemin `/app/...` ouvert par l'app. Abonnement web 404 / 410 retiré ; tokens natifs périmés ou invalides retirés. Retrait en SQL sur la valeur courante de la colonne, pour ne pas écraser un token enregistré entre-temps.
- `sendOnboardingEmailOnce` : une fois par utilisateur, forcé même si EMAIL est désactivé (transactionnel). Le mail « compte activé » est dédupliqué ainsi.

**Brevo** (`third-parties/brevo.ts`, `brevo-templates.ts`) :

- Registre des templates rangé en quatre familles (transactionnels, notices internes, notifications automatiques, cron). Valeur `null` = email encore en texte dans le code ; numérique = template Brevo (`sendTemplateEmail`). Migrer : créer le template, renseigner l'id, router vers `sendTemplateEmail`.
- `sendEmail` / `sendTemplateEmail` renvoient un `SentEmail` ou `false`. En erreur, ni contenu ni paramètres à Sentry (liens avec jeton, données personnelles).
- Email en template, push en texte, dérivés des mêmes `params` (`utils/formatCarcasseEmail.ts`). Accords carcasse / lot résolus dans le code ; singulier / pluriel du bilan de clôture dans le template. `FEI_CLOSED` et `FEI_AUTOMATIC_CLOSED` ont le même contenu mais restent deux templates. Une carcasse « refusée » au bilan = non mise sur le marché. L'établissement à contacter est lu sur les intermédiaires (`latest_intermediaire_entity_id` vaut le SVI une fois assigné). `FEI_ASSIGNED` / `FEI_UNASSIGNED` servent pour un utilisateur ou une entité ; une fiche retirée n'a pas de lien.
- `escapeBrevoPlaceholders` (`utils/sanitize.ts`) casse `{{` et `{%` dans le texte saisi : Brevo les évaluerait après l'envoi.
- `getEmailDeliveryFailure` : premier évènement d'échec (bounces, blocked…) ; une erreur de l'API vaut « pas d'échec » ; `days: 2` couvre minuit.
- Contacts : attributs identiques en création et mise à jour ; SMS / WHATSAPP uniques dans Brevo, remplis seulement si un seul compte porte le numéro, jamais depuis le formulaire public. Les fédérations n'ont pas d'entreprise Brevo. Deal chasseur sans nom : on prend l'email (`getChasseurDealName`). Le passage du deal en « 1ère fiche traitée » est marqué par `at_least_one_fei_treated`.

**Expo push** (`third-parties/expo-push.ts`) : 100 messages par requête ; un seul `to` malformé fait rejeter toute la requête, d'où un filtre par regex. Tokens à purger renvoyés à l'appelant. Seule la production pousse (la preprod a des tokens de vrais chasseurs). `NATIVE_PUSH_DRY_RUN` : rien n'est envoyé ni loggé (`sent` = 0), pour ne pas dédupliquer à tort. Réponse 200 sans `data` gérée.

**Règles d'envoi** (`utils/carcasse-side-effects.ts`, `utils/fei-side-effects.ts`) :

- Assignation SVI : une seule notification par utilisateur SVI grâce à `notificationLogAction` (un envoi Brevo direct serait proportionnel au nombre de carcasses). Elle est exclusive des notifications génériques de prochain détenteur, comme les notifications circuit court.
- Transmission : un seul rendu PDF pour tous les destinataires ; expéditeur en copie d'un seul email. Rien pour un repas de chasse de l'association.
- Circuit court : vérification de remise après `CIRCUIT_COURT_DELIVERY_CHECK_DELAY_MS` (10 s), sans `await` ; en cas d'échec, l'expéditeur reçoit un email texte même s'il a désactivé les emails, dédupliqué par fiche et destinataire.
- Liens : `VITE_APP_URL` + `/app` ajouté par le code (`utils/fei-url.ts`) ; le chasseur ouvre la fiche, les autres rôles une transmission.
- Inscription : la notice interne « Nouvelle ouverture de compte » ne part pas quand le contact est créé lors d'une mise à jour (`notifyTeam: false`). Notice CFEI seulement quand un chasseur déjà inscrit change son numéro. Mail de fin d'onboarding dès que `onboarded_at` est posé.

## Conséquences

- Mettre à jour [emails.md](../emails.md) à chaque email ajouté, retiré ou modifié.
