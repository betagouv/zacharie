# 0021. Examen initial, certification et référentiel des anomalies

## Contexte

L'examinateur initial examine chaque carcasse, relève des anomalies et certifie la mise sur le marché. Le référentiel des anomalies est maintenu hors du dépôt (CSV) et sert aussi au backend (gravité, suspicions sanitaires).

## Décision

**Référentiel** :

- `app-local-first-react-router/scripts/generate-anomalies-referentiel.mjs <csv>` produit `src/data/anomalies/gros.json` et aligne `petit.json`. Colonnes CSV : CATÉGORIE, ANOMALIE, COMPLEMENTS D'INFORMATION, FAMILLE, MESSAGE D'AVERTISSEMENT, NIVEAU AVERTISSEMENT, PHOTOGRAPHIE. Deux coquilles du CSV sont corrigées ; tous les nombres de la colonne photo sont extraits ; une famille sans anomalie nommée est ignorée ; « Champ libre : ... » est la saisie libre de la famille.
- Structure section (groupe + site) → anomalies. Clé stockée « intitulé - site » (« Abcès » existe sur plusieurs sites) ; « intitulé » seul sans site (petit gibier). Gravité 1 (bénin) à 4 (danger), null si absente.
- Une anomalie est grave à partir du niveau 2 (« ne pas commercialiser ») ; sans niveau (tout le petit gibier) ou hors référentiel, elle est grave par prudence. Même règle côté app (`isAnomalieGrave`, `src/utils/anomalies-referentiel.ts`) et API (`api-express/src/utils/anomalies-graves.ts`, qui lit le référentiel de l'app à la source). Une anomalie grave interdit la commercialisation : le PDF de la fiche (`getCertificationExamenInitialText`) n'affirme plus la mise sur le marché, et la décision revient au premier détenteur.
- `src/utils/update-carcasse-anomalies.ts` : écriture centralisée (horodatage, « sans anomalie » recalculé sur les deux tableaux, log). Groupe « Abats » → `examinateur_anomalies_abats`, le reste → `examinateur_anomalies_carcasse`. Saisie libre suffixée par le site (« mon texte - Externe »), suffixe retiré à l'affichage. Une valeur hors référentiel non suffixée s'affiche comme saisie hors famille (reste visible et supprimable).

**Saisie** (`src/components/AnomaliePicker.tsx`, `CarcasseExamenInitialForm.tsx`, `routes/chasseur/chasseur-fei-carcasses.tsx`) :

- La saisie libre compte comme une anomalie de la famille. Un texte saisi mais non validé est versé à la perte de focus (le CTA de la modale reste cliquable). Dans une modale DSFR, « Fermer » remonte d'un niveau (capture sur le dialog) pour ne pas perdre la carcasse. Overlay photo en portail dans `<body>` (le `filter` de `.fr-modal__body` crée un bloc conteneur pour `position: fixed`).
- Numéro de marquage enregistré au `blur` (une écriture, un log). Numéro par défaut : initiales + département (2e segment du CFEI `CFEI-DEP-AA-123`, sinon 6 derniers caractères alphanumériques) + numéro sur 3 chiffres ; `/` et espaces remplacés par `_`.
- Modale d'avertissement : sévérité DSFR dérivée de la gravité (sans niveau : avertissement) ; anomalies dédupliquées par intitulé canonique (« Abcès » sur deux systèmes a deux messages) ; les plus graves en tête ; affichée s'il y a un message ou aucune anomalie.

**Certification** (`routes/chasseur/chasseur-fei.tsx`) : la confirmation « Continuer » ne vaut que pour l'état des carcasses au clic (ajouter ou modifier une carcasse replie les blocs suivants ; retirer une carcasse non). La certification est enregistrée dès la coche (examen validé + approbation de mise sur le marché) et ne se décoche plus. `date_mise_a_mort` est à minuit UTC, la date de validation en heure locale : on compare les jours.

**CFEI** (`src/utils/numero-cfei.ts`) : formats `CFEI-DEP-AA-NNN` ou `DEP-FREI-AA-NNN` ; contrôle en avertissement seulement. Sans CFEI, `createNewFei()` renvoie « Forbidden » et le bouton est caché ; saisir un CFEI met le compte en attente de validation.

**Suspicions sanitaires** (`api-express/src/utils/disease-suspicions.ts`) : signal de veille, sans confirmation vétérinaire. Comparaison sur des valeurs exactes du référentiel : tuberculose (abcès externes, abats respiratoire / digestif, ganglions), pestes porcines (sanglier : lésions hémorragiques, cœur anormal, anomalies « si sanglier »), brucellose (petit gibier à poils : testicules), tularémie (lièvres : abcès, articulations, tête).

## Conséquences

- Renommer une anomalie du référentiel doit casser `disease-suspicions.test.ts`, pas éteindre la détection en silence.
- `isAnomalieGrave` app et API doivent rester alignées.
