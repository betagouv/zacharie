# 0032. Exports, imports de fichiers et données embarquées

## Contexte

Les utilisateurs exportent leurs registres en Excel, l'admin importe des fichiers de l'administration, et l'app embarque des référentiels pour fonctionner hors ligne.

## Décision

**Exports** (`app-local-first-react-router/src/utils/export-*.ts`) :

- Textes tronqués à 32 766 caractères (limite Excel de 32 767 par cellule).
- « SVI - Motif Consigne » pré-rempli avec « BA P S OA CA pap », pour que le SVI entoure le motif sur la feuille imprimée.
- Export des transmissions : catalogue de colonnes (`key` stable mémorisée en localStorage, `label` en français) ; l'ordre du catalogue = export complet ; export simplifié à 4 colonnes ; projection sur les colonnes choisies. Le nombre affiché applique les mêmes exclusions (supprimées, manquantes, refusées), une ligne par carcasse.
- Export LIMS trichine : noms de champs et enums bruts, dates ISO, CSV séparé par `;` (Excel en français), listes en `|` en CSV et en tableau en JSON ; `reference_labo` = alias du labo, `autres_references_internes` = ceux des autres.
- Export CSV des lésions avec BOM (Excel lit l'UTF-8).

**Imports** :

- CCG (export RESYTAL, `src/utils/parse-ccg-sheet.ts`) : en-têtes = première ligne qui contient le numéro DDECPP. Premiers détenteurs (`parse-premiers-detenteurs-sheet.ts`) : en-têtes = première ligne avec la raison sociale ; code postal stocké en nombre par Excel, 0 initial restauré. L'import vide l'input fichier et envoie aussi les lignes existantes (ignorées et comptées par le serveur).

**Données embarquées** :

- `villes.json` (~39 000 communes) : clés abrégées (`c` = code postal, `v` = ville), sans indentation, généré par `src/data/update-villes.js`, verrouillé par des tests.
- Établissements de traitement sanitaire (`src/utils/etablissementsTraitementSaintaire.ts`) : projection du référentiel `api-express/src/assets/etablissements-traitement-sanitaire.json`, 5 champs (`n`, `r`, `a`, `c`, `v`) ; un doublon de libellé renverrait le mauvais numéro d'agrément.

**Dates et filtres** :

- Les dates du serveur sont des chaînes ISO (les types Prisma disent `Date`) : les données locales sont stockées au même format (`dates-to-iso.ts`), objets simples seulement.
- Un filtre enregistré en localStorage dont la valeur ne correspond à aucune option ne filtre pas (`keep-available-filter-values.ts`). Filtre rapide de fiche : au moins une valeur cochée, filtres cumulés ; le filtre « Premier détenteur » couvre aussi les fiches passées par un collecteur. Filtre avancé de carcasses : tous les filtres ; `isNaN(null) === false`, donc pas de `isNaN` pour exclure les non-nombres.

## Conséquences

- Modifier le format d'un fichier embarqué exige de régénérer et de mettre à jour les tests qui le verrouillent.
