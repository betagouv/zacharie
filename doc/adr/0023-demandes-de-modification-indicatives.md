# 0023. Demandes de modification indicatives

## Contexte

Un intermédiaire peut corriger un numéro de marquage (RENAME) ou ajouter une carcasse manquante (NEW_CARCASSE). Bloquer la chaîne en attendant l'examinateur initial retarderait l'inspection d'une denrée périssable. C'est l'intermédiaire qui a la carcasse sous les yeux.

## Décision

**Principe** : une demande est indicative. La modification s'applique dès la création, ne bloque ni l'intermédiaire ni le SVI (inspection possible en `PENDING`) ni l'auto-clôture. L'examinateur initial est informé et donne un avis a posteriori.

**Transitions serveur** (`api-express/src/utils/sync-carcasse-modification-request.ts`) :

- Création (PENDING) : RENAME renomme tout de suite et notifie l'examinateur.
- Approbation : NEW signe l'examen initial (champs portés par `_approvalPayload`, transitoire, non persisté) et notifie le demandeur.
- Refus : NEW soft-delete la carcasse (sauf si le SVI l'a inspectée). Un refus de RENAME ne rétablit pas l'ancien numéro : le désaccord est tracé et notifié.
- Annulation (`deleted_at` posé) : RENAME rétablit le numéro d'origine (lu sur la carcasse, ou sur la demande pour l'auteur qui a déjà écrit le nouveau numéro dans la même synchro), NEW soft-delete la carcasse.
- Seul l'examinateur initial de la carcasse approuve ou refuse (`reviewed_by` signé par le serveur) ; seul le demandeur annule, tant que PENDING. Seule une transition depuis PENDING enregistre une décision.
- Deny by default : seulement sur une carcasse du périmètre ; identité du demandeur décidée par le serveur ; une demande naît PENDING ; une NEW_CARCASSE accompagne une carcasse que le demandeur vient de créer.
- Une carcasse déjà inspectée par le SVI n'est plus supprimable ni renommable (`isCarcasseFrozenBySvi`) : un certificat a pu être émis. La décision est enregistrée sans toucher la carcasse.
- Chaque mutation touche la carcasse (`updated_at`) : le client charge les demandes par carcasse.
- Une demande annulée hors ligne avant sa première synchro est enregistrée annulée, sans effet ni notification.
- Notifications : ton informatif vers l'examinateur ; réponse au demandeur courte et sans lien (même corps pour email et push).

**Client** :

- Une seule demande en cours par carcasse (bouton masqué sinon). Le formulaire s'ouvre en accordéon : le DSFR ne supporte pas une modale dans une modale.
- Ajout d'une carcasse manquante (`RequestNewCarcasseForm.tsx`) : carcasse sans signature examinateur, ligne `CarcasseIntermediaire` (pour apparaître dans la liste et non dans « déjà refusées ») et demande NEW_CARCASSE, le tout par `/sync`. Elle hérite de l'état de transmission (`svi_assigned_at`, `svi_entity_id`, `next_owner_*`) si la fiche est déjà transmise, sinon le SVI ne la voit jamais et l'ETG retransmet sans fin. Statut SANS_DECISION, sinon le SVI perd « Accepter la carcasse ».
- Bannière toujours en sévérité « info ». `CardCarcasse` ne compte que les demandes passées (hors NEW_CARCASSE, signalée par une ligne « Carcasse ajoutée » filtrée sur `!deleted_at`). L'historique éclate chaque demande en deux événements (demande, décision).
- `PendingModifRequestsAlertModal` s'ouvre sur `/app/chasseur` pour l'examinateur concerné, à chaque visite (ref « déjà ouverte pour cette visite »). Les notifications pointent vers `/app/chasseur/demandes-de-modification`.

## Conséquences

- `isCarcasseFrozenBySvi` serveur et la garde client doivent rester alignées.
- Une carcasse supprimée par l'auteur d'un ajout aval passe par l'annulation de sa demande, tant que le SVI n'est pas passé (voir [0007](0007-droits-d-ecriture-du-sync.md)).
