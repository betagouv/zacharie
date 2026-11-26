# 0008. Frontière de prise en charge et propagation fiche → carcasses

## Contexte

Certains champs de la fiche sont recopiés sur chaque carcasse (double écriture client / serveur, voir CLAUDE.md). Une régression a montré le risque : `createCarcasse` appelait `updateFei`, qui repassait toutes les carcasses en `is_synced = false` ; le `/sync` repoussait alors, depuis le snapshot local du chasseur, des carcasses déjà prises en charge par l'aval, et écrasait la prise en charge.

## Décision

Deux frontières distinctes, à ne pas confondre (`app-local-first-react-router/src/utils/carcasse-deja-envoyee.ts`, qui accepte une `Carcasse` ou une `CarcasseTransmission`) :

- **« Un destinataire lui a été attribué »** : la carcasse n'entre plus dans un lot de dispatch (sinon double transmission), mais le chasseur garde la main. Une association désignée premier détenteur porte aussi `next_owner_entity_id` : ce n'est pas un destinataire. Une carcasse gardée pour l'usage domestique sort du lot à répartir.
- **« L'aval l'a réellement prise en charge »** : le chasseur est dessaisi (ni édition, ni suppression) et son poste ne doit plus repousser la carcasse. Côté serveur, même frontière : `carcassePriseEnChargeEnAvalWhere` / `ROLES_AMONT` (`api-express/src/utils/carcasse-prise-en-charge.ts`) ; au-delà, seul le superadmin supprime.

Et :

- `updateFei` (`src/zustand/store.ts`) exclut de la propagation les carcasses prises en charge en aval. Une carcasse transmise mais pas encore prise en charge reste concernée. Le serveur propage de toute façon les dates à toutes les carcasses (`syncCarcasseDates`, supprimées comprises).
- `consommateur_final_usage_domestique` n'est pas recopié par `mapFeiFieldsToCarcasse` : il est propre à chaque carcasse.
- « Le propriétaire initial ne peut plus changer » une fois la fiche transmise en aval : le changer réécrit `next_owner` sur toutes les carcasses et annulerait la transmission sans prévenir. Désigner le premier détenteur ne verrouille pas.
- `createNewCarcasse` (`src/utils/create-new-carcasse.ts`) : avant certification de l'examen, la carcasse démarre chez l'examinateur ; après, elle rejoint directement le premier détenteur (les autres membres de l'association la voient). `premier_detenteur_name_cache` porte le nom de la personne quand le premier détenteur n'est pas une association.
- Côté chasseur (`chasseur/chasseur-fei.tsx`), les droits d'édition se calculent sur les lots encore ouverts : on filtre sur la prise en charge, pas sur le choix du destinataire. Transmettre un lot ne réécrit le détenteur courant que des carcasses encore présentes.
- La carte de carcasse lit l'état de possession de la carcasse elle-même, pas le snapshot de la fiche, périmé après un renvoi.

## Conséquences

- Toute nouvelle propagation de champ fiche → carcasse doit respecter la frontière « prise en charge en aval ».
- Tests : `__tests__/update-fei-scoping.test.ts`, `__tests__/create-new-carcasse.test.ts`, `src/utils/carcasse-deja-envoyee.test.ts`.
- Le check n°1 du cron data health (voir [0037](0037-crons.md)) détecte une entité aval sur une carcasse au rôle `EXAMINATEUR_INITIAL` : c'est l'entité qui est parasite.
