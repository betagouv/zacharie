# 0031. Statistiques, tableaux de bord et saisons de chasse

## Contexte

Plusieurs tableaux de bord (chasseur, fédérations, ETG, SVI, admin) et le bilan DGAL des anomalies comptent des carcasses. Le petit gibier est compté en lots. Le tableau de bord fédérations est décrit dans [federations.md](../federations.md).

## Décision

**Unités** : grand gibier = 1 carcasse = 1 animal ; petit gibier = un lot de plusieurs animaux. Tableaux de bord, export Excel et bilan comptent en animaux. `agree` / `nonAgree` / `domestique` comptent les lignes de carcasse ; les champs `*Animaux` comptent les animaux. Le grand gibier n'a pas de « nombre d'animaux acceptés ».

**Saisons** : deux définitions coexistent dans le code.

- Du 1er juillet au 30 juin, notée « 25-26 » : stats fédérations (`getCurrentSeason`, `api-express/src/utils/federation-stats.ts`), stats chasseur (`controllers/stats.ts`), tonnage admin (`controllers/admin/analytics.ts`), `FederationTableauDeBord.tsx`. La période s'arrête à aujourd'hui tant que la saison n'est pas finie.
- Du 1er juin (N) au 31 mai (N+1), identifiée par N : bilan DGAL (`getSaisonBounds`, `utils/bilan-anomalies.ts`), app (`src/utils/get-saison.ts`), références KPI (`routes/admin/stats-ref.tsx`, de 2020-2021 à deux saisons après la saison en cours).

**Fédérations** (`utils/federation-stats.ts`, `controllers/stats.ts`) :

- Fédérations pré-créées (une FDC par département, une FRC par région, la FNC), ids fixes. Périmètre déclaratif : `entity.scope_departements_codes` seul. 0 département : aucun accès ; 1 : départemental ; 101 : national ; sinon régional. `null` = pas de filtre, seulement si la liste couvre tous les départements. Une fédération voit une autre si tous ses départements sont dans son périmètre.
- Circuit de valorisation : `domestique`, `agree` (ETG), `nonAgree` (circuit court), `null` (pas encore transmise, ou vers collecteur / ETG).
- Département lu dans `Fei.commune_mise_a_mort` (« <code postal> <COMMUNE> ») : DOM/COM sur 3 chiffres, Corse 2A si CP ≤ 20190 sinon 2B, métropole sur 2 chiffres.
- Fiches des comptes admin Zacharie exclues (`EXCLUDE_ADMIN_FEI_WHERE`) ; `isNot` matche aussi une relation nulle. Examinateur actif = au moins une fiche de la saison dont une carcasse est partie chez un destinataire (`prev_owner_role` garde une carcasse renvoyée) ; compté une fois même dans plusieurs départements. Ligne « Total » : pas de somme des taux ni des examinateurs (« — ») ; la tuile « Examinateurs actifs » donne le total dédoublonné. Tous les départements du périmètre ont une ligne. Filtre par département proposé au périmètre national ; détail par département aux périmètres national et régional.

**Score d'hygiène (BPH)** : `100 × (1 − tauxBphPersonnel / (2 × tauxBphNational))`, borné 0-100 (même formule côté app, `src/utils/bph-motifs.ts`). Références nationales fixes : taux BPH grand gibier 5,49 % (`NATIONAL_BPH_RATE_BIG_GAME`), taux de saisie grand gibier 25-26 23,9 %. Taux personnel = carcasses éligibles SVI saisies (totales et partielles) avec un motif BPH / carcasses éligibles SVI, aligné avec `/delta-bph`. Le taux national, dénominateur, est calculé non scopé. Causes de refus : motif intermédiaire + lésions ou motifs IPM1 / IPM2, dédupliqués par carcasse, 5 premières. Motifs disqualifiants = la carcasse aurait dû être refusée à réception.

**ETG / SVI** (`etg-tableau-de-bord.tsx`, `svi-dashboard.tsx`, `etg-utilisateur.tsx`) : comparaison saison en cours à date contre la même période de la saison précédente (variation en % pour un volume, en points pour un taux). Saisies globales = totales + partielles, hors consignes levées. Axe des graphiques borné à 6 minimum (sinon graduation en demis).

**Admin** : tonnage « réel » = saison arrêtée au même jour que aujourd'hui, « potentiel » = saison précédente à la même date ; circuit long seulement.

**Bilan DGAL** (`utils/bilan-anomalies.ts`, `src/utils/export-bilan-anomalies.ts`) : une ligne par ETG et groupe d'espèces du calque, dans l'ordre du calque. Carcasses tuées pendant la saison et prises en charge par un ETG, rattachées au dernier ETG. Chapitre III : motifs Zacharie repris tels quels, un motif IPM1 puis IPM2 compté une fois. Chapitre II : seules deux anomalies tracées. Fiches admin exclues. Un onglet par chapitre ; cellules vides à compléter par le SVI ; chapitre I colonnes D à H.

## Conséquences

- Avant d'ajouter un calcul par saison, choisir explicitement l'une des deux définitions.
- Tests : `stats-federation-formation.test.ts`, `federation-valorisation.test.ts`, e2e `federation/03`, `05`.
