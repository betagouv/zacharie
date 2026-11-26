# 0033. Recherche locale, routes et liens persistants

## Contexte

Les données téléchargées sont déjà limitées au périmètre de l'utilisateur. Des liens anciens (emails, favoris, `initial-path` de l'app native) pointent vers des routes retirées.

## Décision

**Recherche globale** (`src/utils/search-local.ts`, `searchLocally`) : entièrement locale. Ordre : numéro de bracelet, commentaire d'un `CarcasseIntermediaire`, numéro de fiche. ETG, collecteur, SVI et circuit court ouvrent une transmission (un résultat par transmission) ; par bracelet, le SVI ouvre la page d'inspection. Une carcasse supprimée, refusée ou manquante n'est pas recherchable (`isCarcasseSearchable`) ; les carcasses de `/carcasse/refusees` n'apparaissent dans aucune branche. Routes : `/app/svi/fei/…`, `/app/etg/fei/…`, `/app/collecteur/fei/…`, `/app/chasseur/fei/…`.

**Recherche de destinataire** (`search-destinataire.ts`) : chaque mot tapé doit correspondre à un mot du destinataire (exact, début, milieu, ou faute de frappe). Mots de 1-2 lettres ignorés sauf s'ils sont seuls ; nombres courts gardés (« ETG 1 »). Aucune faute tolérée sous 5 lettres. Distance de Damerau-Levenshtein (optimal string alignment) contre le meilleur début de mot.

**Recherche de commune** (`search-ville.ts`) : saisie et référentiel ramenés à la même forme (majuscules, sans accent, « Saint » → « ST »). Chaque mot doit être le début d'un mot. Code postal seulement en tête ; un code postal inconnu (« 75000 ») est ignoré. Un préfixe qui tombe sur une fin de mot prime (« ste » → « Sainte » avant « Stenay »).

**Champs d'adresse** (`InputCodePostalEtVille.tsx`) : composant commun à User et Entity ; chaque champ suit sa propre valeur par défaut ; le parent est averti quand le focus quitte le couple ; les suggestions font `preventDefault` au `mousedown` (sinon la saisie partielle enregistrée écraserait la commune choisie).

**Routes et liens** :

- `/app/tableau-de-bord` (retirée en #391) existe seulement comme redirection vers le tableau de bord du rôle (`TableauDeBordRedirect`). Une ancienne route de fiche est conservée pour les liens d'email envoyés avant la correction de `fei-url`.
- Un lien ouvert avec la ponctuation qui suit (`/)`, `/app/chasseur.`) est corrigé (`src/utils/page-not-found-path.ts`). Le 404 est signalé à Sentry avec chemin, plateforme et `navigation.type` ; les chemins sondés par des robots ne le sont pas.
- Compte sans rôle reconnu : renvoyé sur la page d'accueil (pas sur `/app/connexion`, boucle).
- `?redirect=` n'accepte que les routes internes (`sanitize-redirect.ts`).
- Chaque page pose un `<title>` (sinon URL brute dans l'onglet et page vue sans nom dans Matomo) : `routes-have-a-title.test.ts` le vérifie, en exemptant `Navigate`, `Outlet`, `RootDisplay`, `TableauDeBordRedirect` et les `*Layout`.
- La liste des fiches chasseur est ordonnée « À compléter » → « En cours » → « Clôturée » (`chasseur-fiches.tsx` + `getFeisSorted`).
- Listes : la page n'est réinitialisée que si `filtersKey` change réellement (`setSearchParams` change d'identité à chaque navigation) ; options de filtres calculées à part du filtrage.

## Conséquences

- Ne pas supprimer les routes figées tant que des emails anciens peuvent pointer dessus.
