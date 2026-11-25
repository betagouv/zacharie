# 0020. Premier détenteur, associations et ventes / dons

## Contexte

Le premier détenteur peut être l'examinateur lui-même, un autre chasseur ou une association de chasse. Il répartit ensuite ses carcasses en ventes / dons vers un ou plusieurs destinataires, ou les garde.

## Décision

**Désignation** :

- L'examinateur désigne directement le premier détenteur (`chasseur/examinateur-select-next.tsx`) : pas d'étape « prendre en charge ». Dans l'état « à compléter », la carcasse appartient déjà au premier détenteur (`current_owner = PREMIER_DETENTEUR`, sans `next_owner` ni `prev_owner`), ce qui débloque `canEditAsPremierDetenteur`. L'API ajoute toujours l'utilisateur connecté aux `detenteursInitiaux`.
- Association : on enregistre aussi `premier_detenteur_user_id` (celui qui agit pour elle), mais le sélecteur affiche l'association, jamais « Vous ». La fiche passe à l'association dès la certification de l'examen : tout membre la voit et fait la vente / le don ; celui qui transmet devient détenteur courant. `isPremierDetenteur` ne doit pas se baser seulement sur `fei.premier_detenteur_user_id === user.id`. Quand l'examinateur est aussi premier détenteur via son association (`CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY`), le formulaire bascule en ligne vers la vente / le don, sans page « Votre fiche a été transmise ».
- Premier détenteur = entité : `premier_detenteur_user_id` peut être null côté serveur ; aucune requête Prisma ne doit partir avec un id null.
- Après un renvoi par l'ETG puis un retour à l'association, `next_owner_entity_id` = l'association (rôle `PREMIER_DETENTEUR`) : ce n'est pas une vente transmise.

**Ventes / dons** (`chasseur/premier-detenteur-select-next.tsx`) :

- Une vente / un don = un prochain détenteur + son stockage + son transport + les carcasses. Pas de lot en base : les cartes déjà transmises sont reconstituées en regroupant les carcasses par destinataire + stockage + transport.
- Usage domestique : destinataire sans prochain détenteur, stockage ni transport ; la fiche est clôturée, personne n'est notifié, le bouton devient « Clôturer ». Ces carcasses forment un groupe à part sous un identifiant réservé (`src/utils/usage-domestique.ts`). Association : « Repas de chasse ou associatif », sans alerte « pas prêt pour Zacharie ».
- Transport seulement si le destinataire ne vient pas chercher (collecteur) et n'est pas en bout de chaîne. Le nombre d'étapes peut diminuer : l'étape courante est bornée.
- Destinataires proposés : récents (d'après les carcasses locales), puis jamais utilisés, et toujours « Moi-même » ou « Repas de chasse ». Seuls les partenaires enregistrés par le chasseur (pas ceux vus sur des fiches, relation NONE). Le destinataire d'une fiche précédente n'est repris que s'il est proposé (pas l'association propriétaire initiale).
- Répartition par soustraction : « toutes » par défaut, hors carcasses promises à un autre lot (zone « Part ailleurs », reprise explicite). Une seule carcasse : étape sautée. Liste d'ids figée à la validation ; exclusivité entre lots. Une carcasse créée après coup rejoint le lot par défaut ; une carcasse supprimée ou partie ailleurs est retirée. Une vente vide bloque la transmission et est signalée ; des carcasses non attribuées ne bloquent pas (transmission partielle).
- Le renvoi par l'ETG vide `next_owner` mais garde `premier_detenteur_prochain_detenteur_id_cache` : « Renvoyée par ETG 1, à attribuer de nouveau ».
- Pré-remplissage du premier détenteur (`usePrefillPremierDétenteur`, `isPickable`) : une entité que l'utilisateur ne peut plus choisir (supprimée par l'admin, relation retirée, ou connue seulement via une ancienne fiche) n'est pas reprise, car le serveur refuserait la transmission.

## Conséquences

- Le regroupement côté chasseur ne tient compte que du destinataire choisi par le premier détenteur, pas du reste de la chaîne.
- Tests e2e : série `premier-detenteur/`, `examinateur/26-28`, `30`, `33`, `34`.
