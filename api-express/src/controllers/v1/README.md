# Clé d'accès API pour Zacharie

Il y a deux types de clé
- la clée dédiée à une entité, réclamée par l'entité en question : le champ `dedicated_to_entity_id` a une valeur
- la clée pour les tierces parties qui peut faire des demandes d'accès aux données de divers utilisateurs : le champ `dedicated_to_entity_id` n'a pas de valeur
 
 
## Génération du swagger

Il n'y a rien d'automatique pour le moment : j'ai essaye tsoa mais il y a trop de pollution. J'ai regardé du swagger/typescript, mais souvent c'est dans l'autre sens : on écrit le swagger et ça génère l'API.

Donc la solution est assez 2025 : on demande à Claude de générer le swagger en lisant le code.

Pour s'assurer (au minimum) que la doc est conforme à l'API, on a un test `./swagger-validation.test.ts`, que Claude doit mettre à jour à chaque modification de l'API.


## Documentation

Pour éviter toute confusion, il y a donc deux documentations :
- https://api.zacharie.beta.gouv.fr/v1/docs/cle-dediee/
- https://api.zacharie.beta.gouv.fr/v1/docs/tierces-parties/
