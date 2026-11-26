# Droits d'écriture du /sync — qui écrit quoi

Le client renvoie toujours la carcasse entière, avec les champs des autres rôles tels qu'il les a
reçus. Le serveur n'écrit donc chaque champ que pour le rôle à qui il appartient, et **ignore** la
valeur du corps pour les autres (pas de rejet). Code : `api-express/src/utils/sync-carcasse.ts`,
`api-express/src/utils/sync-carcasse-intermediaire.ts`.

Préalable commun : la carcasse doit être dans le périmètre de l'utilisateur (`scope.canWriteCarcasse`).

## Carcasse

**Détenteur en cours** : l'utilisateur est, sur la carcasse **enregistrée** (pas celle du corps),
le détenteur actuel (`current_owner_user_id` = lui, ou `current_owner_entity_id` = une de ses
entités) ou le prochain détenteur (même règle sur `next_owner_*`). Tant que la carcasse est chez les
chasseurs (`current_owner_role` vide, `EXAMINATEUR_INITIAL` ou `PREMIER_DETENTEUR`), les rattachés à
la fiche (examinateur, premier détenteur, membres de l'asso premier détenteur) le sont aussi. Une
carcasse créée dans la requête est écrite par son créateur.

| Champs                                                                                                                       | Qui écrit                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identité (`numero_bracelet`, `espece`, `type`, dates et heures, `nombre_d_animaux`)                                          | L'examinateur initial, ou le créateur de la carcasse (carcasse manquante ajoutée en aval)                                                         |
| Examen (`examinateur_*`)                                                                                                     | L'examinateur initial de la fiche                                                                                                                 |
| `examinateur_initial_*`, `premier_detenteur_user_id/entity_id/name_cache`                                                    | Les rattachés à la fiche ; sinon copie de la fiche                                                                                                |
| Choix du premier détenteur (`premier_detenteur_depot_*`, `_transport_*`, `_prochain_detenteur_*`, `consommateur_final_*`)    | Le premier détenteur (utilisateur ou membre de l'asso)                                                                                            |
| Transmission (`current_owner_*`, `next_owner_*` dont sous-traitance, `prev_owner_*`, `svi_entity_id`, `svi_assigned_at`)     | Le détenteur en cours                                                                                                                             |
| Clôture et signature intermédiaire (`intermediaire_closed_*`, `latest_intermediaire_*`)                                      | Le détenteur en cours (l'auteur est toujours l'utilisateur courant, pour une de ses entités)                                                      |
| Décision intermédiaire (`intermediaire_carcasse_manquante`, `intermediaire_carcasse_refus_intermediaire_id`, `_refus_motif`) | Le détenteur en cours. Un refus ou un manque déjà enregistré n'est levé ou réécrit que si sa ligne d'intermédiaire est celle d'une de ses entités |
| `svi_carcasse_status` hors SVI                                                                                               | Le détenteur en cours, limité aux statuts sans décision SVI (`canNonSviWriteStatus`). Sortir d'un refus ou d'un manque : même règle que ci-dessus |
| Inspection SVI (`svi_*` hors `svi_entity_id` / `svi_assigned_at`)                                                            | Un utilisateur SVI                                                                                                                                |

## Ligne d'intermédiaire (`CarcasseIntermediaire`)

- Création : l'entité de la ligne (`intermediaire_entity_id`) doit être une entité de l'utilisateur ;
  l'utilisateur de la ligne est toujours l'utilisateur courant.
- Modification : la ligne **existante** doit appartenir à une entité de l'utilisateur, sinon la
  requête est rejetée (`SyncRejectedError`). Un collègue de la même entité peut la modifier.
- L'identité (entité, rôle, utilisateur) n'est jamais réécrite après la création.
