# Zacharie — guide métier pour l'investigation de bugs

Référence dense pour enquêter sur un bug (SQL lecture seule sur la prod + code GitHub). Tout est tiré du code ;
les chemins sont relatifs à la racine du repo. « À vérifier » = non confirmé par lecture du code.

Raccourcis de chemins : `FRONT/` = `app-local-first-react-router/src/`, `API/` = `api-express/src/`,
schéma = `api-express/prisma/schema.prisma`.

## 0. Idées clés (à lire en premier)

- **La propriété vit sur la Carcasse, pas sur la Fei.** `Fei` n'a AUCUN champ `current_owner_*` /
  `next_owner_*` / `prev_owner_*` / `svi_*`. Tout l'état de circulation est sur `"Carcasse"` (schéma, bloc
  « OWNERSHIP FIELDS »). Une fiche = un examen initial ; son état = celui de ses carcasses.
- **Transmission = groupe de carcasses d'une même fiche envoyées au même premier destinataire.** Clé :
  `${fei_numero}__${premier_detenteur_prochain_detenteur_id_cache}` (`FRONT/utils/get-transmission-id.ts`).
  Le premier détenteur peut « dispatcher » une fiche vers plusieurs destinataires : chaque lot vit sa vie.
  Les URLs de fiche côté pro contiennent ce second segment.
- **Les listes et les écrans sont calculés côté client** (store Zustand/IndexedDB), à partir des carcasses
  que le serveur a renvoyées. Il n'y a pas de colonne « statut de fiche » en base.
- **Toute mutation métier part du front** (via `POST /sync`). Le serveur applique les champs reçus sans
  arbitrage métier (hors contrôles d'accès) puis déclenche des effets de bord (notifications, webhooks).

## 1. Acteurs et rôles

### 1.1 `User.roles` (enum `UserRoles`, schéma)

`CHASSEUR`, `COLLECTEUR_PRO`, `ETG`, `SVI`, `COMMERCE_DE_DETAIL`, `CANTINE_OU_RESTAURATION_COLLECTIVE`,
`ASSOCIATION_CARITATIVE`, `REPAS_DE_CHASSE_OU_ASSOCIATIF`, `CONSOMMATEUR_FINAL`, `LABORATOIRE`, `FEDERATION`,
`ADMIN`. Admin Zacharie = `User.isZacharieAdmin` (pas un rôle).

- **Un seul rôle par utilisateur.** Le front lit `user.roles[0]` (`FRONT/utils/get-transmissions-sorted.ts`,
  `computeTransmissions`). Le backend ne l'impose pas encore (zod `roles` sans longueur max, `API/controllers/user.ts`).
  Un compte avec 2 rôles = donnée anormale.
- `User.role` (singulier) existe aussi, migration non faite : ne pas s'y fier, lire `roles`.
- **Chasseur** : examinateur initial si `numero_cfei` renseigné (seul lui peut créer une fiche,
  `FRONT/utils/create-new-fei.ts`), et/ou premier détenteur. `activated=false` : peut préparer une fiche mais pas
  transmettre au-delà du premier détenteur (rejet dans `API/utils/sync-carcasse.ts`).
- **`User.etg_role`** (enum `UserEtgRoles`, défaut `RECEPTION`) : pour un salarié d'ETG.
  - `RECEPTION` : réceptionne à l'atelier (contrôle, refus, envoi au SVI).
  - `TRANSPORT` : transporte uniquement vers son ETG. Voir §2.4.
- **Circuit court** (`COMMERCE_DE_DETAIL`, `CANTINE…`, `ASSOCIATION_CARITATIVE`, `REPAS_DE_CHASSE…`,
  `CONSOMMATEUR_FINAL`) : destinataire terminal passif, pas de SVI, pas de prise en charge
  (`FRONT/utils/circuit-court.ts`, `isRoleCircuitCourt`).

### 1.2 `FeiOwnerRole` (rôle de détention, porté par `current_owner_role` / `next_owner_role` / `prev_owner_role`)

`EXAMINATEUR_INITIAL`, `PREMIER_DETENTEUR`, `ETG`, `COLLECTEUR_PRO`, `SVI`, + les 5 rôles circuit court.
Attention : le rôle de détention décrit l'activité, pas le type d'entité. Cas légitime : `COLLECTEUR_PRO` sur une
entité de type `ETG` (ETG qui transporte lui-même, §2.4) ou `CCG` (cf. `API/cronjobs/data-health.ts`).

### 1.3 Entités (`Entity.type`, enum `EntityTypes`)

`PREMIER_DETENTEUR` (association/société de chasse), `COLLECTEUR_PRO`, `CCG` (chambre froide), `ETG`, `SVI`,
circuit court ×5, `LABORATOIRE`, `FDC`/`FRC`/`FNC` (fédérations). `Entity.etg_linked_to_svi_id` = SVI rattaché
à un ETG. `Entity.etg_demande_numero_bon_reception` = l'ETG demande un n° de bon à la prise en charge.

### 1.4 Relations utilisateur ↔ entité (`EntityAndUserRelations`)

- `CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY` : l'utilisateur **travaille pour** l'entité (membre).
  `status` ∈ `REQUESTED` / `MEMBER` / `ADMIN`. **Seuls MEMBER/ADMIN donnent accès aux carcasses**
  (`API/utils/user-entities.ts`, `getUserCarcasseEntityIds`). Une relation `REQUESTED` = l'utilisateur ne voit rien.
- `CAN_TRANSMIT_CARCASSES_TO_ENTITY` : l'utilisateur peut **envoyer** à l'entité (partenaire). Créée
  automatiquement au `/sync` quand un `next_owner_entity_id` est posé (`API/controllers/sync.ts`,
  `API/utils/sync-carcasse.ts`).
- `WORKING_FOR_ENTITY_RELATED_WITH`, `NONE` : jamais stockés en base, valeurs calculées côté app.
  (à vérifier : aucune référence trouvée dans `API/` ni `FRONT/` hors schéma/migrations.)
- `deleted_at` non nul = relation supprimée.
- Côté front, « mes entités » = `entities` du store avec `relation === CAN_HANDLE…` et non supprimées
  (`FRONT/utils/get-entity-relations.ts`, `filterEntitiesWorkingDirectlyForObj`).
- `UserRelations` (user↔user) : `PREMIER_DETENTEUR` / `EXAMINATEUR_INITIAL`, carnet d'adresses du chasseur.

## 2. Cycle de vie d'une fiche et de ses carcasses

Identifiants : `Fei.numero` = `ZACH-YYYYMMDD-<userId>-HHmmss` (`create-new-fei.ts`) ;
`Carcasse.zacharie_carcasse_id` = `{fei_numero}_{numero_bracelet}` ;
`CarcasseIntermediaire.intermediaire_id` = `{user_id}_{fei_numero}_{HHmmss}` (+ suffixe `_transport` /
`_reception` dans le cas §2.4 b). Unicité CI : `(fei_numero, zacharie_carcasse_id, intermediaire_id)`.

### 2.1 Création (examinateur initial)

`FRONT/utils/create-new-fei.ts` + `FRONT/utils/create-new-carcasse.ts`. Chaque carcasse naît avec
`current_owner_role=EXAMINATEUR_INITIAL`, `current_owner_user_id=<examinateur>`, `next_owner_*`/`prev_owner_*`=null.
Une fiche sans carcasse n'existe que côté Fei ; côté chasseur elle apparaît « À compléter » (transmission simulée
dans `computeTransmissions`). Suppression : log `current-owner-delete` (`examinateur-initial-delete-fei.tsx`).

### 2.2 Désignation du premier détenteur

`FRONT/routes/chasseur/examinateur-select-next.tsx` (`handleSubmitFromSelect`) : écrit sur la Fei
`premier_detenteur_user_id/entity_id/name_cache` et sur les carcasses `next_owner_role=PREMIER_DETENTEUR`,
`next_owner_user_id`, `next_owner_entity_id` (si association), `premier_detenteur_*`. Log `examinateur-select-next`.
Puis « Transmettre » (`chasseur-fei.tsx`, `handleTransmettre`) pose `current_owner_role=PREMIER_DETENTEUR`,
`current_owner_user_id`, `current_owner_entity_id` (pas de log dédié, seulement `syncData`).

### 2.3 Transmission par le premier détenteur (dispatch)

`FRONT/routes/chasseur/premier-detenteur-select-next.tsx` (`handleSubmit`), par groupe de carcasses :

- `next_owner_entity_id=<destinataire>`, `next_owner_role=<Entity.type>`,
  `premier_detenteur_prochain_detenteur_id_cache/role_cache` (= clé de transmission, ne change plus ensuite),
  `premier_detenteur_depot_type` (`CCG`/`ETG`/`AUCUN`) + `premier_detenteur_depot_entity_id` + `_ccg_at`,
  `premier_detenteur_transport_type` (`PREMIER_DETENTEUR` = « je transporte moi-même »,
  `COLLECTEUR_PRO` = « transport réalisé par un collecteur professionnel ») + `_transport_date`.
- `next_owner_user_id` n'est PAS posé : le destinataire est une entité, tous ses membres le voient.
- Log `premier-detenteur-need-select-next-select-destinataire`. Usage domestique : `consommateur_final_usage_domestique`
  - log `premier-detenteur-usage-domestique` (carcasse terminale).
- Serveur : `notifyNextOwnerEntity` notifie les membres de l'entité quand `next_owner_entity_id` change
  (`API/utils/carcasse-side-effects.ts`). Circuit court : `notifyCircuitCourt` et, si tout le lot est en
  circuit court, pose `svi_automatic_closed_at` sur le lot (clôture immédiate).

### 2.4 Prise en charge par un intermédiaire (collecteur / ETG)

Composants : `FRONT/routes/collecteur/collecteur-current-owner-confirm.tsx`,
`FRONT/routes/etg/etg-current-owner-confirm.tsx`. Visible seulement si `next_owner_role` non nul, que les carcasses
ne sont pas toutes terminées, et `canConfirmCurrentOwner` (ETG : `next_owner_entity_id` = une de mes entités
CAN_HANDLE, `next_owner_role=ETG`, rôle ETG).

a) **Prise en charge standard** (`handlePriseEnCharge`) : crée une `CarcasseIntermediaire` par carcasse
(`prise_en_charge=true` par défaut, `intermediaire_role`, `intermediaire_entity_id=<ancien next_owner_entity_id>`)
puis pose : `current_owner_*` = moi/mon entité, `next_owner_*` = null, `prev_owner_*` = ancien `current_owner_*`.
Logs `intermediaire-create` + `current-owner-confirm-collecteur-pro` | `current-owner-confirm-etg-reception`.

b) **ETG réception + transport à enregistrer** (`handleETGReceptionWithTransport`) : si `needTransportFromETG`
(dernier intermédiaire a déposé en CCG, ou aucun intermédiaire et `premier_detenteur_transport_type ≠ PREMIER_DETENTEUR`).
Crée 2 CI (rôle `COLLECTEUR_PRO` suffixe `_transport`, puis rôle `ETG` suffixe `_reception`), pose
`current_owner_role=ETG`. Logs `intermediaire-create` ×2 + `current-owner-confirm-etg-reception-with-transport`.

c) **Salarié ETG `etg_role=TRANSPORT`** (bouton « Prendre en charge », action
`current-owner-confirm-etg-transport-by-me`, `etgEmployeeTransportingToETG=true`). **C'est le « passage automatique »
à la réception** : en un seul geste le front pose

- `current_owner_role=COLLECTEUR_PRO`, `current_owner_entity_id=<mon ETG>`, `current_owner_user_id=<salarié transport>` ;
- `next_owner_role=ETG`, `next_owner_entity_id=<mon ETG>` (le même), `next_owner_user_id=null` ;
- `prev_owner_*` = l'expéditeur (ex. `PREMIER_DETENTEUR`) ;
- une CI `intermediaire_role=COLLECTEUR_PRO`, `intermediaire_entity_id=<mon ETG>`,
  `intermediaire_prochain_detenteur_id_cache=<mon ETG>`, `intermediaire_depot_type=AUCUN`.
  Aucun code serveur ne fait ce passage : c'est l'écriture client ci-dessus. `next_owner_entity_id` ne change pas
  (même ETG) donc `notifyNextOwnerEntity` ne renotifie pas l'atelier. Le code est commenté
  « deprecated anyway and broken for multi-dispatch ». Ensuite un salarié `RECEPTION` voit « Prendre en charge »
  (→ a), `current_owner_role` repasse à `ETG`) ou « Renvoyer à l'expéditeur ». Le salarié TRANSPORT, lui, voit
  « Les carcasses sont transportées vers … » (`isETGEmployeeAndTransportingToETG`).

### 2.5 Décisions par carcasse (intermédiaire)

`FRONT/routes/etg/etg-carcasse.tsx`, `FRONT/routes/collecteur/collecteur-carcasse.tsx`. Écrit la CI
(`prise_en_charge`, `refus`, `manquante`, `ecarte_pour_inspection`, `decision_at`, `nombre_d_animaux_acceptes`) ET
la Carcasse :

- **Refus** : `intermediaire_carcasse_refus_intermediaire_id=<intermediaire_id>`, `intermediaire_carcasse_refus_motif`.
- **Manquante** : `intermediaire_carcasse_manquante=true` + `refus_intermediaire_id`.
- **Écartée pour inspection** (ETG) : CI `ecarte_pour_inspection=true`, pas de refus carcasse.
- **Acceptée** : CI `prise_en_charge=true`, `check_manuel=true`.
  `svi_carcasse_status` est recalculé côté client à chaque `updateCarcasse` (`FRONT/utils/get-carcasse-status.ts` :
  manquante → `MANQUANTE_ETG_COLLECTEUR`, refus → `REFUS_ETG_COLLECTEUR`, etc.). Serveur : `notifyRefusChasseur`,
  `notifyManquanteChasseur`.
  **Clôture par l'intermédiaire** si rien d'accepté ni écarté : `intermediaire_closed_at/_by_user_id/_by_entity_id`
  (logs `intermediaire-check-finished-at`, `intermediaire-close-fei-manquantes-ou-rejetees`, `etg-fei.tsx`).

### 2.6 Transmission par l'intermédiaire

`FRONT/routes/etg/etg-destinataire-select-intermediaire.tsx` (idem collecteur) : `next_owner_entity_id`,
`next_owner_role=<type>` ; si SVI : `svi_assigned_at=now`, `svi_entity_id`. CI : `intermediaire_prochain_detenteur_*`,
`intermediaire_depot_*` (dépôt CCG seulement pour un collecteur). Log `intermediaire-next-owner-select-destinataire`.
`current_owner_*` reste l'intermédiaire jusqu'à la prise en charge suivante.

### 2.7 Sous-traitance du transport (ETG ou collecteur destinataire)

1. `current-owner-sous-traite-request` : `next_owner_wants_to_sous_traite=true`, `next_owner_sous_traite_by_user_id`.
2. `current-owner-sous-traite-select-destinataire-sous-traite` (`etg-destinataire-select-sous-traite.tsx`) :
   `next_owner_entity_id/role` = transporteur choisi, `next_owner_sous_traite_at/_by_user_id/_by_entity_id`,
   `next_owner_wants_to_sous_traite=false`, et **`current_owner_*` = `prev_owner_*`** (les `*_name_cache` ne sont
   pas mis à jour). 3. `current-owner-sous-traite-change-mind` annule l'étape 1.
   L'entité qui sous-traite garde la fiche « En cours » via `next_owner_sous_traite_by_entity_id`.

### 2.8 SVI

Accès SVI : `svi_assigned_at` non nul ET (`svi_entity_id` ou `next_owner_entity_id` ∈ mes entités)
(`API/utils/carcasse-access.ts`). Inspection IPM1/IPM2 : `svi_ipm1_*`, `svi_ipm2_*` (logs `svi-ipm1-edit`,
`svi-ipm2-edit` ; `FRONT/routes/svi/svi-inspection-carcasse/ipm1.tsx`, `ipm2.tsx`, `FRONT/utils/svi-approve-carcasse.ts`).
Seul un utilisateur SVI peut écrire `svi_user_id`, `svi_closed_at`, `svi_ipm*` (`sync-carcasse.ts`).
**Clôture manuelle** (`FRONT/routes/svi/svi-fei.tsx`, `closeFiche`) : `svi_closed_at`, `svi_closed_by_user_id`,
statut `ACCEPTE` si sans décision, et prise de propriété `current_owner_role=SVI`, `next_owner_*`=null, `prev_owner_*`.
Logs `svi-check-finished-at` / `svi-check-finished-at-update`.
**Clôture automatique** (cron quotidien 8h, `API/cronjobs/feis.ts`, `automaticClosingOfFeis`) : carcasses avec
`svi_assigned_at` ≤ J-10, non closes → `svi_automatic_closed_at`, `current_owner_role=SVI`, statut recalculé.
Quand tout le lot est terminal : email « fiche clôturée » au chasseur (`closeFeiAndNotifyChasseurOnSviCarcasseClose`).
Certificats (`CarcasseCertificat`) : `checkCertificat` si IPM1/IPM2 daté.

### 2.9 États terminaux d'une carcasse (`FRONT/utils/is-carcasse-done.ts`, `isCarcasseDone`)

Terminale si : `svi_closed_at` ou `svi_automatic_closed_at` ; `intermediaire_closed_at` ;
`intermediaire_carcasse_refus_intermediaire_id` ; `intermediaire_carcasse_manquante` ;
`consommateur_final_usage_domestique` ; `next_owner_role` ou `current_owner_role` circuit court ; ou
`svi_carcasse_status` ∈ {ACCEPTE, MANQUANTE*\*, REFUS_ETG_COLLECTEUR, SAISIE*\*, LEVEE_DE_CONSIGNE,
TRAITEMENT_ASSAINISSANT}. `CONSIGNE` et `SANS_DECISION` ne sont pas terminaux. Une transmission est « Clôturée »
quand toutes ses carcasses sont terminales. Les carcasses refusées en amont sont chargées à part
(`FRONT/utils/load-carcasses-refusees.ts`, route `/carcasse/refusees/:fei_numero`).

### 2.10 Renvoyer à l'expéditeur (`current-owner-renvoi`)

`handleRenvoi` dans `etg-current-owner-confirm.tsx` et `collecteur-current-owner-confirm.tsx` : pose UNIQUEMENT
`next_owner_entity_id/_name_cache`, `next_owner_user_id/_name_cache`, `next_owner_role` = null.
**`current_owner_*` et `prev_owner_*` ne sont pas modifiés** : la carcasse reste chez le détenteur courant,
qui est « l'expéditeur ». `next_owner_wants_to_sous_traite` et `next_owner_sous_traite_*` non plus.
Côté client : si le compte n'a jamais été intermédiaire (ni lui ni une de ses entités dans les CI), le numéro de fiche
est ajouté à `feiIdsRenvoiToHide` (local, IndexedDB uniquement, jamais en base) et masqué des listes ;
il est retiré quand le serveur renvoie de nouveau la fiche (`FRONT/utils/load-carcasses.ts`).
Serveur : `notifyRenvoiExpediteur` détecte `next_owner_role` passé à null avec `current_owner_user_id/role` inchangés,
et notifie `current_owner_user_id` (NotificationLog.action `FEI_RENVOYEE_<fei>_<entity ou user renvoyeur>`).

## 3. Modèle de propriété (colonnes de `"Carcasse"`)

| Groupe            | Colonnes                                                                                                                 | Écrit par                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Courant           | `current_owner_role`, `_user_id`, `_user_name_cache`, `_entity_id`, `_entity_name_cache`                                 | prise en charge (§2.4), transmettre chasseur (§2.2), clôture SVI (§2.8), sous-traitance (§2.7)                  |
| Suivant           | `next_owner_role`, `_user_id`, `_user_name_cache`, `_entity_id`, `_entity_name_cache`                                    | choix du destinataire (§2.2, 2.3, 2.6) ; vidé par prise en charge et renvoi                                     |
| Sous-traitance    | `next_owner_wants_to_sous_traite`, `next_owner_sous_traite_at/_by_user_id/_by_entity_id`                                 | §2.7                                                                                                            |
| Précédent         | `prev_owner_role`, `_user_id`, `_entity_id` (pas de name_cache)                                                          | prise en charge, clôture SVI, cron                                                                              |
| Premier détenteur | `premier_detenteur_*` (copie Fei), `premier_detenteur_prochain_detenteur_id_cache` (clé de transmission)                 | §2.2, 2.3                                                                                                       |
| Intermédiaire     | `intermediaire_closed_*`, `intermediaire_carcasse_refus_*`, `intermediaire_carcasse_manquante`, `latest_intermediaire_*` | §2.5 (à vérifier : `latest_intermediaire_user_id/entity_id/name_cache` ne semblent écrits par aucun code front) |
| SVI               | `svi_assigned_at`, `svi_entity_id`, `svi_user_id`, `svi_closed_at`, `svi_automatic_closed_at`, `svi_carcasse_status`     | §2.6, 2.8                                                                                                       |

- Les `*_name_cache` sont des copies d'affichage : ils peuvent être périmés (ex. sous-traitance).
- Dual-write Fei → Carcasse : `mapFeiFieldsToCarcasse` (`FRONT/utils/map-fei-fields-to-carcasse.ts`, dates +
  examinateur + premier détenteur) côté client, `syncCarcasseDates` (`API/utils/fei-side-effects.ts`, dates seules)
  côté serveur. Pour un détenteur aval, le serveur force `examinateur_initial_user_id` / `premier_detenteur_*` depuis
  la Fei (`canWriteOwnership`, `sync-carcasse.ts`).
- `CarcasseIntermediaire` = historique des prises en charge (une ligne par carcasse × intermédiaire). Le front
  les trie par `created_at` décroissant ; « le dernier intermédiaire » = la plus récente.

### 3.1 Qui voit quoi : périmètre serveur (`API/utils/carcasse-access.ts`, `getCarcasseAccessWhere`)

Même WHERE pour `GET /carcasse` (lecture, delta sur `updated_at >= after`) et pour `/sync` (écriture).

- CHASSEUR : `premier_detenteur_user_id`, `examinateur_initial_user_id`, `current/next/prev_owner_user_id` = moi ;
  ou `current/prev_owner_entity_id` ∈ mes entités ; ou `premier_detenteur_entity_id`/`next_owner_entity_id` ∈ mes
  entités avec `current_owner_role ≠ EXAMINATEUR_INITIAL`.
- ETG / COLLECTEUR_PRO / circuit court : une CI avec `intermediaire_entity_id` ∈ mes entités, OU
  `next_owner_entity_id` ∈ mes entités, OU `current_owner_entity_id` ∈ mes entités. (`prev_owner_entity_id` non inclus.)
- SVI : §2.8. Autres rôles : aucun accès (403).
  Refus d'écriture → `SyncRejectedError`, remonté dans Sentry (« Écritures /sync refusées »), rien en base.

### 3.2 Listes « À compléter / En cours / Clôturée » (`FRONT/utils/get-transmissions-sorted.ts`, `computeTransmissions`)

Toutes les pages `*-fiches.tsx` utilisent `useTransmissionsSorted`. Par transmission, première carcasse non
terminale trouvée, dans cet ordre :

1. **À compléter** si `isCarcasseUnderMyResponsability` (`is-carcasse-done.ts`) : aucun `next_owner_user_id` ni
   `next_owner_entity_id`, ET (`current_owner_user_id` = moi OU `current_owner_entity_id` ∈ mes entités CAN_HANDLE).
   Exception : salarié `etg_role=TRANSPORT` et `current_owner_role=ETG` → non.
2. **À compléter** (hors SVI) si `isCarcasseToTake` : `next_owner_user_id` = moi OU `next_owner_entity_id` ∈ mes
   entités, sauf `isTransportToMyEtgDone` (salarié TRANSPORT, current=COLLECTEUR_PRO de mon ETG, next=ETG mon ETG).
3. **En cours** si pas `svi_assigned_at` ni `intermediaire_closed_at` et : je suis examinateur initial, premier
   détenteur (user ou entité), mon entité a sous-traité, ou moi/mon entité figure dans une CI.
4. Si `svi_assigned_at` : SVI → À compléter tant que non clos ; autres → En cours.
5. Sinon **Clôturée** (valeur par défaut).
   Puis `feiIdsRenvoiToHide` retire des fiches (ETG, collecteur ; `etg-fiches.tsx`, `collecteur-fiches.tsx`).
   Libellé d'étape (`FRONT/utils/transmission-labels.ts`) : chasseur (`getCurrentStepLabelForChasseur`) :
   `current_owner_role` EXAMINATEUR_INITIAL → « Information manquante » / « Validation par le premier détenteur » ;
   PREMIER_DETENTEUR → « Validation… » (next null) / « Fiche envoyée, pas encore prise en charge » ;
   COLLECTEUR_PRO → « Prise en charge par le transporteur » ; sinon « Traitement des carcasses ».
   Circuit court : toujours « Clôturée ».

### 3.3 « Aucune action à effectuer » (`FRONT/components/FeiAucuneAction.tsx`)

Affiché par `FRONT/routes/etg/etg-fei.tsx` et `FRONT/routes/collecteur/collecteur-fei.tsx` quand `showInterface`
vaut null. ETG (`EtgFeiLoader`), dans l'ordre, l'interface s'affiche si :
aucune de mes carcasses → null ; `current` ou `next_owner_role=SVI` ; `current=COLLECTEUR_PRO` et
`current_owner_user_id` = moi ; `current=COLLECTEUR_PRO` et `next=ETG` ; `current` ou `next = ETG` ;
moi (user_id, pas l'entité) dans une CI ; mon entité ETG a sous-traité. Sinon → « Aucune action à effectuer ».
Collecteur : `current=COLLECTEUR_PRO` avec entité à moi ; `next=COLLECTEUR_PRO` avec entité à moi ; mon entité
dans une CI. Le chasseur (`chasseur-fei.tsx`) n'utilise pas ce composant (édition bloquée via `canEdit`).

## 4. Journal des actions (`"Log"`)

Écrit côté client (`addLog`, `FRONT/zustand/store.ts`), poussé par `/sync` (`prisma.log.createMany`, skipDuplicates).

- `user_id`, `user_role` (rôle _de détention_ au moment de l'action, pas forcément `User.roles`), `fei_numero`,
  `entity_id`, `action`, `history` (`{before, after}` des seuls champs modifiés, `createHistoryInput`),
  `date` = heure du device, `created_at` = heure d'insertion serveur. Écart important = action faite hors ligne.
- `intermediaire_id` est TOUJOURS null en base : le serveur n'écrit que `fei_intermediaire_id` (que le client
  remplit avec l'intermediaire_id). Filtrer sur `fei_intermediaire_id`.
- `history` : le client fait `JSON.stringify` avant envoi ; probablement stocké comme chaîne JSON
  (à vérifier ; essayer `(history #>> '{}')::jsonb`).
- `zacharie_carcasse_id` est null pour les actions de transmission (elles portent sur un lot).
- Pas de log pour : « Transmettre » de l'examinateur (§2.2), les écritures serveur (cron, side effects).
- Notifications envoyées : table `"NotificationLog"` (`user_id`, `action`, `type`, `created_at`).

| action                                                                                                                 | effet principal                                                       | fichier (FRONT/…)                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `examinateur-create-fei`                                                                                               | crée Fei                                                              | `utils/create-new-fei.ts`                                                                                                                                                                               |
| `examinateur-update-fei`                                                                                               | modifie Fei (+ propagation carcasses)                                 | `routes/chasseur/chasseur-fei.tsx`                                                                                                                                                                      |
| `examinateur-carcasse-create/edit/delete`                                                                              | carcasse                                                              | `routes/chasseur/examinateur-carcasses-nouvelle.tsx`, `examinateur-carcasse-detail.tsx`, `chasseur-fei-carcasses.tsx`, `components/CarcasseExamenInitialForm.tsx`, `utils/update-carcasse-anomalies.ts` |
| `examinateur-select-next`                                                                                              | next*owner=PREMIER_DETENTEUR, premier_detenteur*\*                    | `routes/chasseur/examinateur-select-next.tsx`                                                                                                                                                           |
| `current-owner-delete`                                                                                                 | suppression fiche                                                     | `routes/chasseur/examinateur-initial-delete-fei.tsx`                                                                                                                                                    |
| `premier-detenteur-need-select-next-select-destinataire`                                                               | next_owner_entity/role, dépôt, transport, clé transmission            | `routes/chasseur/premier-detenteur-select-next.tsx`                                                                                                                                                     |
| `premier-detenteur-usage-domestique`                                                                                   | `consommateur_final_usage_domestique`                                 | idem                                                                                                                                                                                                    |
| `intermediaire-create`                                                                                                 | nouvelle(s) CI                                                        | `routes/{etg,collecteur}/*-current-owner-confirm.tsx`                                                                                                                                                   |
| `current-owner-confirm-collecteur-pro`                                                                                 | current=COLLECTEUR_PRO (moi), next=null, prev=ancien current          | `routes/collecteur/collecteur-current-owner-confirm.tsx`                                                                                                                                                |
| `current-owner-confirm-etg-reception`                                                                                  | current=ETG (moi), next=null, prev=ancien current                     | `routes/etg/etg-current-owner-confirm.tsx`                                                                                                                                                              |
| `current-owner-confirm-etg-reception-with-transport`                                                                   | 2 CI (transport+réception), current=ETG                               | idem                                                                                                                                                                                                    |
| `current-owner-confirm-etg-transport-by-me`                                                                            | current=COLLECTEUR_PRO (mon ETG, moi), next=ETG (même ETG, user null) | idem                                                                                                                                                                                                    |
| `current-owner-renvoi`                                                                                                 | next*owner*\* = null ; current/prev inchangés                         | `etg-current-owner-confirm.tsx`, `collecteur-current-owner-confirm.tsx`                                                                                                                                 |
| `current-owner-sous-traite-request`                                                                                    | wants_to_sous_traite=true                                             | idem                                                                                                                                                                                                    |
| `current-owner-sous-traite-select-destinataire-sous-traite`                                                            | next=transporteur, current=prev                                       | `routes/{etg,collecteur}/*-destinataire-select-sous-traite.tsx`                                                                                                                                         |
| `current-owner-sous-traite-change-mind`                                                                                | annule la demande                                                     | `routes/{etg,collecteur}/*-current-owner-sous-traite.tsx`                                                                                                                                               |
| `carcasse-intermediaire-{accept,accept-partiel,refus,manquante,ecarte-pour-inspection,nombre-animaux-acceptes-update}` | CI de la carcasse                                                     | `routes/etg/etg-carcasse.tsx`, `routes/collecteur/collecteur-carcasse.tsx`                                                                                                                              |
| `carcasse-{accept,accept-partiel,refus,manquante,ecarte-pour-inspection}`                                              | champs `intermediaire_carcasse_*` de la Carcasse                      | idem                                                                                                                                                                                                    |
| `intermediaire-check-finished-at`                                                                                      | CI.prise_en_charge_at ; intermediaire_closed_at si rien d'accepté     | `routes/{etg,collecteur}/*-fei.tsx`                                                                                                                                                                     |
| `intermediaire-close-fei-manquantes-ou-rejetees`                                                                       | intermediaire_closed_at                                               | idem                                                                                                                                                                                                    |
| `intermediaire-next-owner-select-destinataire`                                                                         | next*owner*\* ; svi_assigned_at si SVI                                | `routes/{etg,collecteur}/*-destinataire-select-intermediaire.tsx`                                                                                                                                       |
| `svi-ipm1-edit`, `svi-ipm2-edit`                                                                                       | décisions SVI                                                         | `routes/svi/svi-inspection-carcasse/ipm{1,2}.tsx`, `utils/svi-approve-carcasse.ts`                                                                                                                      |
| `svi-check-finished-at`, `svi-check-finished-at-update`                                                                | svi_closed_at, current=SVI                                            | `routes/svi/svi-fei.tsx`                                                                                                                                                                                |

## 5. Local-first et synchronisation

- Store Zustand persisté en IndexedDB (`FRONT/zustand/store.ts`, `PERSISTED_KEYS` : feis, carcasses,
  carcassesIntermediaireById, logs, feiIdsRenvoiToHide, lastUpdateFromServer…). Toute mutation met
  `is_synced=false` + `updated_at` local.
- **Push** : `syncData()` (`FRONT/utils/sync-data.ts`) envoie en UN `POST /sync` tous les items `is_synced=false`
  (feis, carcasses, CI, demandes de modif, logs). Si `isOnline=false` (`FRONT/utils-offline/use-is-offline.ts`),
  rien n'est envoyé ; au retour en ligne un `syncData('is-online')` part. Une nouvelle sync annule celle en cours.
- Ordre serveur (`API/controllers/sync.ts`) : Feis → Carcasses (parallèle ×10) → CI → demandes de modif → Logs →
  side effects carcasses → side effects Fei. Une erreur sur un item n'arrête pas les autres.
- **Le serveur n'arbitre pas les conflits** : il applique chaque champ présent dans le body (`hasOwnProperty`),
  sans comparer `updated_at` (`sync-carcasse.ts`). Colonne `updated_at` = heure serveur de la dernière écriture
  (`@updatedAt`). Dernier arrivé gagne, même s'il a été fait plus tôt hors ligne.
- **Pull** : après chaque sync, `loadCarcasses()` (`FRONT/utils/load-carcasses.ts`) lit `GET /carcasse?after=
lastUpdateFromServer` (delta sur `updated_at`). Fusion `mergeItems` (`FRONT/utils/merge-fetched-items.ts`) :
  **la version serveur remplace toujours la locale** (pas de comparaison d'`updated_at`, contrairement à ce que dit
  `app-local-first-react-router/CLAUDE.md`).
- Pourquoi un log ou une modif manque en base : device resté hors ligne (données encore en IndexedDB du device) ;
  refus d'autorisation (`SyncRejectedError`, Sentry, l'item n'est plus renvoyé pendant la session) ; compte non
  activé ; erreur transitoire (Sentry, retentée à la prochaine sync) ; déconnexion / `clearCache` avant sync.
  Un `Log.date` très antérieur au `created_at` = action faite hors ligne puis synchronisée.
- `feiIdsRenvoiToHide` est local au device : une fiche masquée sur un poste peut rester visible sur un autre.

## 6. Où regarder quand…

Requête de base :

```sql
SELECT zacharie_carcasse_id, numero_bracelet, premier_detenteur_prochain_detenteur_id_cache AS transmission,
  current_owner_role, current_owner_entity_id, current_owner_user_id,
  next_owner_role, next_owner_entity_id, next_owner_user_id, prev_owner_role, prev_owner_entity_id,
  next_owner_sous_traite_by_entity_id, svi_assigned_at, svi_closed_at, svi_automatic_closed_at,
  intermediaire_closed_at, intermediaire_carcasse_refus_intermediaire_id, intermediaire_carcasse_manquante,
  svi_carcasse_status, deleted_at, updated_at
FROM "Carcasse" WHERE fei_numero = $1 ORDER BY numero_bracelet;
SELECT * FROM "CarcasseIntermediaire" WHERE fei_numero = $1 ORDER BY created_at;
SELECT date, created_at, user_id, user_role, entity_id, action, history FROM "Log" WHERE fei_numero = $1 ORDER BY date;
SELECT owner_id, entity_id, relation, status, deleted_at FROM "EntityAndUserRelations" WHERE owner_id = $user;
SELECT id, roles, etg_role, activated FROM "User" WHERE id = $user;
```

- **Fiche visible mais « Aucune action à effectuer »** (ETG/collecteur) : comparer `current_owner_*` /
  `next_owner_*` avec les règles `showInterface` (§3.3). Cas typique : `next_owner_*` null (renvoi, §2.10) et
  `current_owner_user_id` ≠ l'utilisateur, sans CI à son `user_id`. Vérifier `User.etg_role`.
- **Fiche absente d'une liste** : 1) périmètre serveur (§3.1) : l'entité de l'utilisateur est-elle dans
  `current/next_owner_entity_id` ou dans une CI ? relation `CAN_HANDLE…` en `MEMBER`/`ADMIN` et non supprimée ? 2) `Carcasse.deleted_at` / `Fei.deleted_at` ; 3) fiche masquée localement par un renvoi (`feiIdsRenvoiToHide`,
  pas en base : chercher un log `current-owner-renvoi` de cet utilisateur) ; 4) filtres de la page ; 5) données pas encore synchronisées depuis le device émetteur (pas de log correspondant).
- **Carcasse « bloquée »** : aucune transmission possible si `next_owner_role` null et personne en `current_owner`
  ne peut agir ; `current_owner_role` ETG/COLLECTEUR_PRO sans CI de l'entité détentrice (check dédié dans
  `API/cronjobs/data-health.ts`) ; `CarcasseModificationRequest` en `PENDING` (indicatif, ne bloque pas) ;
  statut `CONSIGNE` (attend IPM2) ; incohérence entre carcasses d'une même transmission (Sentry
  « Transmssion differs from one of the carcasses », `FRONT/utils/get-carcasses-transmission.ts`).
- **Chasseur voit « En cours »** : aucune carcasse sous sa responsabilité ni à prendre, et il est examinateur /
  premier détenteur, sans `svi_assigned_at` ni `intermediaire_closed_at`. Le libellé vient de `current_owner_role`
  (§3.2). Il reste « En cours » tant qu'aucune carcasse n'est terminale, quel que soit l'état de `next_owner_*`.
- **Notification non reçue** : `"NotificationLog"` par `user_id` + `action` ; les déclencheurs sont dans
  `runCarcasseUpdateSideEffects` (`API/utils/carcasse-side-effects.ts`) ; ils comparent l'ancienne et la nouvelle
  ligne, donc un champ inchangé ne notifie pas. Emails : `doc/emails.md`.

## 7. Cas réel : transport ETG « par moi » puis renvoi par la réception

Scénario : le chasseur transmet à l'ETG X avec « transport réalisé par un collecteur professionnel ». Un salarié
T de X (`etg_role=TRANSPORT`) prend en charge, puis un salarié R de X (`etg_role=RECEPTION`) clique
« Renvoyer à l'expéditeur ».

| Étape             | Log                                                                  | current_owner (role / entity / user)        | next_owner (role / entity / user) | prev_owner_role              |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------- | --------------------------------- | ---------------------------- |
| Chasseur transmet | `premier-detenteur-need-select-next-select-destinataire`             | PREMIER_DETENTEUR / asso ou null / chasseur | ETG / X / null                    | null                         |
| T prend en charge | `intermediaire-create` + `current-owner-confirm-etg-transport-by-me` | COLLECTEUR_PRO / X / T                      | ETG / X / null                    | PREMIER_DETENTEUR            |
| R renvoie         | `current-owner-renvoi` (user R, user_role ETG, entity_id X)          | COLLECTEUR_PRO / X / T (inchangé)           | null / null / null                | PREMIER_DETENTEUR (inchangé) |

`premier_detenteur_transport_type=COLLECTEUR_PRO`. Une CI par carcasse : `intermediaire_role=COLLECTEUR_PRO`,
`intermediaire_entity_id=X`, `intermediaire_user_id=T`, `intermediaire_prochain_detenteur_id_cache=X`,
`intermediaire_depot_type=AUCUN`. Aucune CI de rôle ETG. `notifyRenvoiExpediteur` notifie **T** (l'expéditeur
= `current_owner_user_id`), pas le chasseur.

Pourquoi ce que voit chacun :

- **R (réception) — liste ETG « À compléter »** : `next_owner_*` null et `current_owner_entity_id = X` ∈ ses
  entités → `isCarcasseUnderMyResponsability` vrai. Pas masquée : `jaiDejaPrisEnCharge` est vrai car une CI a
  `intermediaire_entity_id = X`, donc `hideFeiRenvoi` n'est pas appelé. Libellé : « Prise en charge par le
  transporteur » (`current_owner_role=COLLECTEUR_PRO`).
- **R — page fiche « Aucune action à effectuer »** : `showInterface` null car `current=COLLECTEUR_PRO` mais
  `current_owner_user_id = T ≠ R`, `next_owner_role` null (ni ETG ni SVI), R n'a aucune CI à son `user_id`
  (le test porte sur l'utilisateur, pas l'entité), pas de sous-traitance. Le bouton « Prendre en charge » n'existe
  plus (`CurrentOwnerConfirm` renvoie null si `next_owner_role` est null).
- **Chasseur — « En cours »** : aucune carcasse sous sa responsabilité (`current_owner` = T/X) ni à prendre
  (`next_owner_*` null) ; il est examinateur/premier détenteur, pas de `svi_assigned_at` ni
  `intermediaire_closed_at`. Libellé « Prise en charge par le transporteur ». Il ne peut plus éditer
  (`canEdit` : `current_owner_role` ≠ PREMIER_DETENTEUR/EXAMINATEUR_INITIAL).
- **T (transport)** : liste « À compléter » (`current_owner_user_id = T`, et l'exception TRANSPORT ne joue que si
  `current_owner_role=ETG`). Sur la page, `showInterface` = COLLECTEUR_PRO et `canEdit` vrai (T est
  `current_owner_user_id` et auteur de la CI). À vérifier : T voit probablement le choix d'un destinataire
  (`etg-destinataire-select-intermediaire.tsx`), non testé ici.
  Le « renvoi » ne rend donc pas la fiche au chasseur : il la laisse chez le transporteur interne de X, sans
  prochain détenteur. Le check data-health « sans CarcasseIntermediaire de l'entité détentrice » ne la signale pas
  (une CI de X existe).

## 8. URL → composant

Routeurs : `FRONT/App.tsx` monte sous `/app` : connexion, chasseur, etg, collecteur, circuit-court, svi,
laboratoire, federation, admin (+ `/app/nouvelle-fiche`, `/app/tableau-de-bord`, `/app/proconnect`).
`:tid` = `:premier_detenteur_prochain_detenteur_id_cache` (id de l'entité destinataire choisie par le premier
détenteur, 2e partie de la clé de transmission).

| URL                                                              | Composant (FRONT/routes/…)                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/chasseur`, `/app/chasseur/fiches`                          | `chasseur/chasseur-fiches.tsx`                                                                                                                                                                              |
| `/app/chasseur/fei/:fei_numero`                                  | `chasseur/chasseur-fei.tsx` (inclut `examinateur-select-next.tsx`, `premier-detenteur-select-next.tsx`)                                                                                                     |
| `/app/chasseur/fei/:fei_numero/envoyée`                          | `chasseur/chasseur-fei-envoyée.tsx`                                                                                                                                                                         |
| `/app/chasseur/carcasse/:fei_numero/:zacharie_carcasse_id`       | `chasseur/examinateur-carcasse-detail.tsx`                                                                                                                                                                  |
| `/app/chasseur/carcasse-svi/:fei_numero/:zacharie_carcasse_id`   | `chasseur/chasseur-svi-inspection-carcasse.tsx`                                                                                                                                                             |
| `/app/chasseur/tableau-de-bord`                                  | `chasseur/tableau-de-bord/chasseur-tableau-de-bord.tsx`                                                                                                                                                     |
| `/app/chasseur/demandes-de-modification[/:request_id]`           | `chasseur/chasseur-demandes-de-modification.tsx`, `chasseur-demande-de-modification-detail.tsx`                                                                                                             |
| `/app/etg`                                                       | `etg/etg-fiches.tsx`                                                                                                                                                                                        |
| `/app/etg/carcasses`                                             | `etg/etg-carcasses.tsx`                                                                                                                                                                                     |
| `/app/etg/fei/:fei_numero/:tid`                                  | `etg/etg-fei.tsx` (inclut `etg-current-owner-confirm.tsx`, `etg-current-owner-sous-traite.tsx`, `etg-carcasse.tsx`, `etg-destinataire-select-intermediaire.tsx`, `etg-destinataire-select-sous-traite.tsx`) |
| `/app/etg/carcasse-svi/:fei_numero/:zacharie_carcasse_id`        | `etg/etg-carcasse-after-svi-inspection.tsx`                                                                                                                                                                 |
| `/app/etg/utilisateurs[/:userId]`                                | `etg/etg-utilisateurs.tsx`, `etg/etg-utilisateur.tsx`                                                                                                                                                       |
| `/app/etg/entreprise/informations`                               | `etg/profil/etg-entreprise.tsx` (l'utilisateur y choisit son `etg_role` ; aussi `etg/onboarding/2-entreprise.tsx`, admin `admin/user.$userId.tsx`)                                                          |
| `/app/collecteur`                                                | `collecteur/collecteur-fiches.tsx`                                                                                                                                                                          |
| `/app/collecteur/carcasses`                                      | `collecteur/collecteur-carcasses.tsx`                                                                                                                                                                       |
| `/app/collecteur/fei/:fei_numero/:tid`                           | `collecteur/collecteur-fei.tsx` (+ `collecteur-current-owner-confirm.tsx`, `collecteur-carcasse.tsx`, …)                                                                                                    |
| `/app/collecteur/carcasse-svi/:fei_numero/:zacharie_carcasse_id` | `collecteur/collecteur-carcasse-after-svi-inspection.tsx`                                                                                                                                                   |
| `/app/svi`                                                       | `svi/svi-fiches.tsx` (onglets À compléter / Clôturée)                                                                                                                                                       |
| `/app/svi/tableau-de-bord`, `/app/svi/carcasses`                 | `svi/svi-dashboard.tsx`, `svi/svi-carcasses.tsx`                                                                                                                                                            |
| `/app/svi/fei/:fei_numero/:tid`                                  | `svi/svi-fei.tsx`                                                                                                                                                                                           |
| `/app/svi/carcasse-svi/:fei_numero/:zacharie_carcasse_id`        | `svi/svi-carcasse-svi-inspection.tsx` (IPM : `svi/svi-inspection-carcasse/`)                                                                                                                                |
| `/app/circuit-court`                                             | `circuit-court/circuit-court-fiches.tsx`                                                                                                                                                                    |
| `/app/circuit-court/fei/:fei_numero/:tid`                        | `circuit-court/circuit-court-fei.tsx`                                                                                                                                                                       |
| `…/profil/*`, `…/entreprise/*`, `…/onboarding/*`                 | sous-dossiers `profil/`, `onboarding/` de chaque rôle                                                                                                                                                       |

Les routes trichine (`/app/chasseur/trichine…`, `/app/svi/trichine…`) n'existent que si `TRICHINE_FEATURE_ENABLED`.
Un rôle qui ouvre l'URL d'un autre rôle est redirigé vers `/app/connexion` par le layout (ex. `chasseur-layout.tsx`).
