# 0022. Intermédiaires (ETG, collecteur) : prise en charge, renvoi et verrou

## Contexte

Un collecteur ou un ETG reçoit des lots, les prend en charge, décide carcasse par carcasse (accepté, refusé, manquant), puis transmet. Plusieurs salariés d'une même entité peuvent agir sur la même fiche. Seul le SVI clôt officiellement.

## Décision

**Prise en charge** (`collecteur/collecteur-fei.tsx`, `etg/etg-fei.tsx`, `etg/etg-current-owner-confirm.tsx`) :

- L'intermédiaire de référence est le plus récent de mon entreprise ; après une prise en charge, on sélectionne le nouvel intermédiaire. En multi-destinataires, on filtre les carcasses dont je suis `next_owner`.
- Le bloc de prise en charge ne s'affiche que si la fiche m'est adressée et que je n'ai pas déjà pris en charge toutes mes carcasses.
- Réception ETG avec transport (`handleETGReceptionWithTransport`) : deux intermédiaires (transport en rôle COLLECTEUR_PRO, réception en rôle ETG) et une seule mise à jour de transmission, pour éviter la course. Un salarié ETG « transport uniquement » clique « Prendre en charge » et la fiche part automatiquement à son ETG ; ce qui est pris en charge par l'atelier ne le concerne plus. Un COLLECTEUR_PRO sur une entité ETG est un état transitoire jusqu'à la confirmation par un salarié RECEPTION.
- Pas d'étape « Transport » quand le premier détenteur transmet à un collecteur (il vient chercher). Un collecteur ne transmet jamais directement au SVI : seuls des ETG sont proposés.
- Numéro de bon de réception : saisi une fois au contrôle à réception si l'ETG a activé le réglage (valable pour tous ses salariés), reporté sur chaque carcasse prise en charge ; le transport n'en a pas. `InputNumeroBonReception.tsx` rappelle ceux du jour et de la veille depuis le store local (marche hors ligne). Le certificat SVI et le registre ETG lisent celui de l'ETG qui a reçu la carcasse.

**Décision sur une carcasse** (`collecteur-carcasse.tsx`, `etg-carcasse.tsx`) : la valeur de `CarcasseIntermediaire` prime sur celle de `Carcasse`. Petit gibier refusé : 0 animal accepté ; acceptation complète : total ; partielle : saisie bornée. « Lot partiellement accepté » existe pour le petit gibier, « écarté pour inspection » pour l'ETG. Un refus partiel de lot n'a pas de motif ETG. On teste « manquante » avant « refus » (`_refus_intermediaire_id` est aussi posé pour une manquante).

**Renvoi à l'expéditeur** (`handleRenvoi`) : le destinataire vide `next_owner` ; `current_owner` (l'expéditeur) ne change pas. Stockage et transport de l'envoi annulé sont effacés ; `premier_detenteur_prochain_detenteur_id_cache` est gardé pour l'affichage. Pas de renvoi quand l'expéditeur est le transport de mon propre ETG. La fiche sort du périmètre serveur de l'ETG ; le masquage est persisté localement pour marcher hors ligne. Sur un second appareil, le contrôle d'intégrité recharge (voir [0005](0005-pull-delta-et-perimetre-de-lecture.md)). L'expéditeur est notifié une fois par (fiche, destinataire qui renvoie).

**Sous-traitance** : impossible si une autre entreprise a déjà sous-traité. Une fiche sous-traitée reste visible en lecture seule dans « En cours » tant qu'elle est chez le sous-traitant.

**Verrou** : seul le SVI verrouille une fiche (clôture manuelle ou cron). Un refus total par l'ETG ou le collecteur laisse la fiche à l'intermédiaire, état terminal avec `intermediaire_closed_at`, mais modifiable. Côté ETG, `canEdit` se base sur `isCarcasseClosedBySvi`, pas sur `isCarcasseDone`. Côté collecteur, `effectiveCanEdit` se base sur `isCarcasseDone` mais la modale de décision utilise `canEditCarcasseDecision`. Le verrou ne porte que sur prise en charge, transmission et ajout de carcasse. Pour clôturer, il faut au moins une carcasse manquante ou refusée et aucune acceptée ou écartée.

**Affichage** : cartes à clé stable (l'id, pas le numéro de marquage modifiable). Ordre : SANS_DECISION, puis type → espèce → bracelet.

## Conséquences

- Élargir un verrou ferme la modale de décision dès le dernier refus (e2e `68-refus-total-reste-editable`, `74-…`).
- Le check « prise en charge orpheline » du cron data health surveille les carcasses détenues sans `CarcasseIntermediaire` (voir [0037](0037-crons.md)).
