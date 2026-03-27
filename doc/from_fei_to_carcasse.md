## Plan pour basculer d'une logique Fei vers une logique Carcasse

On a créé l'architecture de données de Zacharie avec la logique suivante : l'atome principal est une Fiche (Fei), qui a des Carcasse, chacune avec un CarcasseIntermediaire. Jusqu'à maintenant, toutes les carcasses d'une Fei avaient les mêmes intermédiaires. Mais dorénavant, les carcasses d'une même Fei peuvent avoir des intermédiaires différents.

On a envie de repenser totalement la logique, en faisant de la Carcasse l'atome principal, et non plus la Fei.
Ce qui fait sens avec la raison d'être du logiciel : traçabilité des carcasses.

Ça implique pas mal de changements, listés ci-dessous sous forme de stratégie d'implémentation.

### Séparation des vues

Aujourd'hui, on a une vue pour tous, la même, c'est la merde
Donc on va splitter par rôles : chaque rôle aura sa propre vue, et ça sera BEAUCOUP plus propre et sinmple à comprendre/

Vues :
- Examinateur initial :
  - Fiches d'Examen Initial
    - Fiche d'Examen Initial (avec carcasses)
- Premier détenteur :
  - Chasses (équivalent à une Fiche d'Examen Initial)
    - Chasse (avec carcasses) (équivalent à une Fiche d'Examen Initial)
  - (option : Destinataires ? si jamais y'a dispatch ça pourrait être utile ? pas d'actualité)
- ETG/Collecteur :
  - Carcasse Intermédiaire (le numéro de fiche sera indiqué dans les "Données de chasse") (mais on appelle ça quand même la vue "Fiche ?")
    - Carcasse Intermédiaire (avec carcasses)
  - Carcasses
    - Carcasse, avec données de chasse et résumé de la décision SVI
- SVI :
  - Carcasse Intermédiaire [final, ETG] (le numéro de fiche sera indiqué dans les "Données de chasse")  (mais on appelle ça quand même la vue "Fiche ?")
    - Carcasse Intermédiaire [final, ETG] (avec carcasses)
  - Carcasses
    - Carcasse, avec données de chasse et résumé de la décision SVI

Chaque vue aura son propre endpoint API, et son propre affichage.


### Endpoints API

On va avoir des endpoints par role :

- Examinateur initial :
  - GET /carcasse
  - GET /carcasse/{carcasse_id}
  - POST /carcasse
  - GET /fei/{fei_numero}
  - POST /fei/{fei_numero}
  - POST /premier-detenteur (pour la transmission à la personne suivante)
- Premier détenteur :
  - GET /carcasse
  - GET /carcasse/{carcasse_id}
  - POST /carcasse-intermediaire (pour la transmission à la personne suivante)
- Circuit court :
  - GET /carcasse (tous les carcasses)
  - GET /carcasse-intermediaire/{carcasse_intermediaire_id} (qui inclue toutes les carcasses spécifiques)
  - GET /carcasse/{carcasse_id}
- ETG/Collecteur :
  - GET /carcasse (tous les carcasses)
  - GET /carcasse-intermediaire/{carcasse_intermediaire_id} (qui inclue toutes les carcasses spécifiques)
  - GET /carcasse/{carcasse_id}
  - POST /carcasse-intermediaire (pour la transmission à la personne suivante)
- SVI :
  - GET /carcasse-intermediaire (tous les intermediaires)
  - GET /carcasse-intermediaire/{carcasse_intermediaire_id} (qui inclue toutes les carcasses)
  - GET /carcasse/{carcasse_id}


### Synchronisation des données et gestion du store en local

Aujourd'hui, chaque MAJ de Fei trigger une synchronisation globale. Que faut-il faire de ça ?
Aussi, le store est une réplique de la base de données, comment s'occupe-t-on des regroupements par Fei/CarcasseIntermediaire ?

Réponses :
- on trigger le `sync` manuellement quand on en a besoin
- on créée des fonctions utilitaires pour faire les regroupements par Fei/CarcasseIntermediaire

### Gestion du store en local

Comment structurer le store, tout de même ? Parce que si on a des dizaines de milliers de carcasses, il faut être efficace - tout en maintenant la lisibilité et la maintenabilité.

Proposition :
- trois objets : 
  - carcasses (clé: zacharie_carcasse_id, valeur: Carcasse), avec une référence à la Fei
  - feiByNumero (clé: fei_numero, valeur: Fei), sans référence aux carcasses
  - carcassesIntermediaires (clé: carcassesIntermediairesId, valeur: CarcasseIntermediaire), avec une référence à la Fei, à une carcasse à un intermédiaireId (mais y'a pas de table Intermediaire, toutes les infos de l'intermediaire sont inclues dans la ligne)

En fait on a besoin d'avoir plein de trucs en mémoire pour pouvoir marcher en mode hors-ligne.
Mais on ne peut pas TOUT mettre en mémoire, sinon dans 2 ans c'est vraiment la merde.
Donc on a qu'à se dire : on met tout en mémoire pour les données < 1 an, glissant. Pour les données plus anciennes, on fait des calls API.

Pas besoin d'indexer genre "carcassesByFei" ou autre : parce qu'on limite les données en mémoire à celles de l'année en cours, le pire cas est environ 50k carcasses dans l'année, et 1000 carcasses par Fei. Donc on peut se permettre de faire des loops et ne rien indexer/memoriser.

Use cases :
- Examinateur initial / Premier détenteur :
  - on veut avoir un regroupement des carcasses par Fei, pour l'affichage principal, trié par status de carcasses, ou par date de mise à mort, etc.
    - on loop sur toutes les carcasses, et on groupe par Fei : `groupByFeiNumero(carcasses)` (O(n))
    - le statut d'un groupement par Fei est le statut le plus bas parmi les carcasses du Fei : si une carcasse est "A compléter", le statut du Fei est "A compléter", si une est "En cours", le statut du Fei est "En cours", si toutes sont "Clôturée", le statut du Fei est "Clôturée". Le statut est défini pendant le loop précédent (donc O(1) par carcasse)
    - puis on trie les Fei par date de mise à mort, ou par status de carcasses, etc. (O(n log n))
  - on veut avoir les carcasses d'une Fei, pour la vue du chasseur
    - on utilise le `feiByNumero` (O(1))
    - on filtre les carcasses par Fei (O(n))
- Intermédiaire (ETG/Collecteur) :
  - on veut avoir un regroupement des carcasses par intermédaire, pour l'affichage principal, trié par status de carcasses, ou par date de mise à mort, etc.
    - on loop sur tous les carcassesIntermediaire, et on groupe par IntermediaireId (O(n))
    - pour chaque carcasseIntermediaire, on va récupérer la carcasse correspondante, la Fei correspondante (O(1))
    - le statut d'un groupement par intermédaire est le statut le plus bas parmi les carcasses du intermédaire : si une carcasse est "A compléter", le statut du intermédaire est "A compléter", si une est "En cours", le statut du intermédaire est "En cours", si toutes sont "Clôturée", le statut du intermédaire est "Clôturée". Le statut est défini pendant le loop précédent (donc O(1) par carcasse)
    - puis on trie les intermédaires par date de mise à mort, ou par status de carcasses, etc. (O(n log n))
  - on veut avoir les carcasses d'un intermédaire, pour la vue de l'intermédaire
    - on filtre les carcassesIntermediaires par IntermediaireId (O(n))
    - pour chaque carcasseIntermediaire, on va récupérer la carcasse correspondante, la Fei correspondante (O(1))
- SVI : on pioche dans les use cases précédents

### Suppression des champs depreciés de la Fei

TODO