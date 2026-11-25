# 0024. Inspection SVI, clôture et certificats

## Contexte

Le SVI inspecte les carcasses (IPM1, puis IPM2 si consigne), les clôt et émet des certificats. Avec le dispatch, la clôture ne peut plus vivre sur la fiche. Sans décision, une carcasse est acceptée automatiquement après 10 jours.

## Décision

**Clôture par carcasse** :

- Le SVI clôt carcasse par carcasse ; la fiche est close pour lui quand toutes ses carcasses le sont. En clôturant, la propriété passe au SVI sur tout le groupe de transmission. IPM1 et IPM2 ne mettent à jour que le même groupe.
- États terminaux (`isCarcasseDone`) : la carcasse ne progressera plus. CONSIGNE et SANS_DECISION ne le sont pas. Une fiche est terminée quand toutes ses carcasses le sont (source unique pour le tri et le libellé « Clôturée » ; ne pas conclure par vacuité si les carcasses ne sont pas chargées). `isCarcasseClosedBySvi` est plus étroit (clôture SVI explicite) et sert aux gardes d'édition.
- Côté serveur (`closeFeiAndNotifyChasseurOnSviCarcasseClose`, `api-express/src/utils/carcasse-side-effects.ts`) : quand toutes les carcasses sont terminales, on maintient le cache `Fei.svi_closed_at` (lu par les vues matérialisées et l'API v1), puis on notifie examinateur et premier détenteur. Idempotent : garde `!fei.svi_closed_at`, dédup `notificationLog`.
- Dates SVI (`src/utils/get-latest-svi-dates.ts`) : assignation, clôture manuelle (`svi_closed_at`) et automatique (`svi_automatic_closed_at`) sont trois types ; on retient la plus tardive de chaque type.

**Auto-acceptation** (`api-express/src/cronjobs/feis.ts`, voir [0037](0037-crons.md)) : chaque carcasse assignée au SVI depuis plus de 10 jours est clôturée. Une demande de modification en cours ne la retient pas. Un sanglier attend un résultat trichine négatif.

**Date d'assignation** (`getSviAssignedAt`, `utils/sync-carcasse.ts`) : elle ouvre l'auto-acceptation, donc une date antidatée permettrait d'accepter sans inspection. La date du client est gardée si elle a moins de `SVI_ASSIGNED_AT_MAX_DELAY_HOURS` (48 h), ou si c'est déjà celle de la carcasse ou d'une autre carcasse de la fiche ; sinon date serveur.

**Inspection** :

- Refus (saisie totale) et traitement assainissant relèvent de l'IPM2, qui n'apparaît qu'après une IPM1 en `MISE_EN_CONSIGNE` ; celle-ci exige pièces inspectées et lésions.
- Acceptation en un clic (`useApproveCarcasse`, `src/utils/svi-approve-carcasse.ts`) = IPM1 « Acceptée » ; elle fait passer la propriété au SVI si `current_owner_role !== SVI`, n'accepte que la carcasse cliquée. Le cœur ne synchronise pas : l'acceptation en masse synchronise une fois à la fin, page bloquée pendant l'opération ; blocages regroupés par motif.
- Sanglier en circuit agréé : pas d'acceptation sans résultat trichine négatif, fail-closed tant que les analyses ne sont pas chargées. L'IPM2 suggère une décision selon le résultat du LNR.

**Carcasses à venir et traçabilité amont** (`api-express/src/controllers/svi.ts`, `utils/svi.ts`) : le SVI voit les carcasses acceptées chez un ETG rattaché mais pas encore transmises (il partage les locaux et prélève la trichine à l'arrivage). Servies hors du store local-first (`/carcasses-a-venir`, `/tracabilite-amont`), car le store SVI ne contient que les carcasses transmises. Volumes en animaux.

**Certificats** (`api-express/src/utils/generate-certificats.ts`, `controllers/certificats.ts`) : numéro par incrément atomique (`inc_certificat`). Le certificat cite l'ETG qui a reçu cette carcasse et son bon de réception. Seul un SVI de l'entité assignée liste, lit ou génère, et seulement le certificat de sa décision ; une seconde demande renvoie le même. Zip groupé limité à `MAX_CARCASSES_PAR_ZIP` (200), certificats actifs seulement, un échec n'arrête pas le zip. Génération en ligne.

## Conséquences

- Ne jamais réécrire la clôture sur la fiche : `Fei.svi_closed_at` n'est qu'un cache.
- `canNonSviWriteStatus` : une décision SVI n'est réécrite que par le SVI (voir [0007](0007-droits-d-ecriture-du-sync.md)).
