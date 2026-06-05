# Trichine — Spécifications fonctionnelles & techniques

> **Statut** : Premier jet — en cours de validation métier
> **Dernière maj** : 2026-06-02
> **Owner** : Tangi Mendès
> **Sources** : spec métier V2 (parcours utilisateurs) + schéma de base de données associé

---

## Résumé exécutif

### Pourquoi ce chantier

La **trichine** (_Trichinella spp._) est un parasite microscopique présent dans la viande de sanglier, dangereux pour l'Homme. La réglementation (UE 2015/1375) impose une recherche de larves sur **chaque carcasse de sanglier** mise sur le marché. Aujourd'hui Zacharie ne trace PAS ces analyses : seul un modal d'avertissement frontend rappelle l'obligation au chasseur lors d'une cession circuit court.

### Ce qu'on construit

Zacharie devient l'outil de traçabilité de la chaîne complète des analyses trichine pour les deux circuits :

| Circuit                                                           | Qui prélève ? | Qui paie ?    | Émetteur du pool/FTP au LVD |
| ----------------------------------------------------------------- | ------------- | ------------- | --------------------------- |
| **Agréé / long** (ETG)                                            | SVI en ETG    | État          | SVI                         |
| **Court** (commerce détail, repas associatif, consommateur final) | 1er détenteur | 1er détenteur | 1er détenteur               |

L'unité d'analyse n'est pas la carcasse individuelle mais le **pool** (jusqu'à 19 carcasses). Les pools sont transmis au LVD via une **FTP** (Fiche de Transmission des Prélèvements). En cas de résultat douteux, une hiérarchie de pools (**mère / fille / petite-fille**) permet d'identifier la carcasse incriminée, et le pool douteux est envoyé au **LNR** pour confirmation.

### Ce qui change pour les utilisateurs

| Rôle                                                         | Impact                                                                                                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Chasseur / 1er détenteur** (circuit court)                 | Nouveaux écrans : créer échantillon, créer pool, créer FTP, envoyer LVD, recevoir résultats, retirer carcasse de FEI si positif  |
| **SVI** (circuit agréé)                                      | Mêmes écrans + auto-acceptation des sangliers désactivée (obligation analyse), décisions IPM conditionnées par résultat trichine |
| **ETG**                                                      | Vue lecture seule du statut trichine sur ses carcasses                                                                           |
| **Commerce détail / repas asso / asso caritative / cantine** | Vue statut trichine ; bloqué tant que pas de résultat négatif                                                                    |
| **Consommateur final**                                       | Réception par email (si 1er détenteur l'active) du message cuisson 71°C                                                          |
| **LVD (Laboratoire agréé)**                                  | Nouveau rôle : interface dédiée pour saisir les résultats des pools                                                              |
| **LNR**                                                      | Entité unique : reçoit les pools douteux pour confirmation                                                                       |

### Concept UX transversal : statut utilisateur

Chaque carte (carcasse / échantillon / pool / FTP) affiche **deux statuts** :

- **Statut métier** (ex : `À compléter`, `En cours d'analyses`, `Analyses terminées`)
- **Statut utilisateur** parmi `À faire` / `En cours` / `Clôturé` — guide l'action attendue

Pour la carcasse, un champ explicite `action_requise` indique l'action à mener (`AUCUNE` / `PRELEVEMENT_COMPLEMENTAIRE` / `ANALYSE_EN_COURS_LVD` / `CONFIRMATION_EN_COURS_LNR`).

### Ce qui est HORS V1

- Arrêtés préfectoraux (obligation pour consommateur final)
- Parcours FDC (centralisation départementale)
- Interface DDPP / DDETSPP + notifications autorités
- Surveillance territoriale, bilan analyses, vue admin agrégée
- API d'interconnexion avec systèmes traçabilité internes des labos
- Dérogation découpe avant résultat (circuit agréé)
- Multi-1ers-détenteurs sur un même pool circuit court (uniquement SVI peut mixer en circuit agréé)

---

## 1. Cadre réglementaire

Référence : règlement (UE) n°2015/1375 + Instruction DGAL 2021-555.

### 1.1 Obligation d'analyse

| Cas                                                  | Statut                                                    |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Sanglier en ETG (circuit agréé)                      | **Obligatoire** — prise en charge État                    |
| Cession circuit court à commerce de détail           | **Obligatoire** — à la charge du 1er détenteur            |
| Cession circuit court à repas de chasse / associatif | **Obligatoire**                                           |
| Cession à consommateur final                         | Recommandée (obligatoire si arrêté préfectoral — hors V1) |
| Usage domestique privé du chasseur                   | Fortement recommandée                                     |

### 1.2 Si pas d'analyse

Message obligatoire à transmettre au consommateur :

> « Le sanglier peut être porteur d'un parasite : la trichine. C'est pourquoi la viande de sanglier doit toujours être bien cuite à cœur ! »

Cuisson minimale : 71°C à cœur en tout point.

### 1.3 Liste officielle des laboratoires agréés

https://agriculture.gouv.fr/laboratoires-officiels-et-reconnus-en-sante-animale

### 1.4 Rapports COFRAC

Les rapports d'analyses (LVD et LNR) sont accrédités COFRAC. **Zacharie ne peut PAS les générer**. Les PDF émis par les labos sont uploadés manuellement dans Zacharie via la table `TrichineDocument`.

---

## 2. Vocabulaire

| Terme                                                 | Définition                                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Échantillon**                                       | Morceau de muscle prélevé sur une carcasse (pilier diaphragme / langue / membre antérieur). Identifié par `reference_echantillon` auto-généré. |
| **Échantillon initial**                               | 1er échantillon prélevé sur une carcasse. Masse 5 g.                                                                                           |
| **Échantillon complémentaire**                        | 2e ou 3e échantillon prélevé après pool douteux. Masse 20 g (mini-pool) ou 50 g (individuel).                                                  |
| **Échantillon de confirmation**                       | Échantillon transmis au LNR. Le type est ré-attribué automatiquement.                                                                          |
| **Pool**                                              | Regroupement d'échantillons analysés ensemble. Max **19 carcasses** / 100 g par pool initial. Identifié par `reference_pool` auto-généré.      |
| **Pool initial**                                      | 1er pool sur des carcasses sans analyse.                                                                                                       |
| **Pool complémentaire (mère / fille / petite-fille)** | Pool créé après résultat douteux du pool précédent. Référence le pool parent via `pool_parent_id`.                                             |
| **Pool de confirmation**                              | Pool transmis au LNR. Type ré-attribué automatiquement.                                                                                        |
| **FTP** (Fiche de Transmission des Prélèvements)      | Document regroupant les pools d'une expédition au LVD ou au LNR. Identifiée par `numero_fiche` auto-généré.                                    |
| **LVD**                                               | Laboratoire agréé (liste DGAL) — réalise les analyses initiales et complémentaires                                                             |
| **LNR**                                               | Laboratoire National de Référence (ANSES Maisons-Alfort) — confirme les résultats douteux                                                      |
| **Émetteur**                                          | Acteur qui envoie une FTP : SVI (agréé), 1er détenteur (court), LVD (vers LNR)                                                                 |
| **Résultat négatif**                                  | Pas de larve. Carcasses du pool acceptées.                                                                                                     |
| **Résultat douteux**                                  | LVD a détecté une larve — confirmation LNR obligatoire + analyses 2e intention (mère/fille/petite-fille) optionnelles.                         |
| **Analyse impossible**                                | LVD refuse le pool (échantillons non analysables). Équivalent au statut "absence d'analyse".                                                   |
| **Résultat non négatif**                              | LNR identifie une larve autre que trichine (parasite nommé).                                                                                   |
| **Présence de parasite non identifié**                | LNR n'a pas pu identifier la larve.                                                                                                            |
| **Résultat positif**                                  | LNR confirme la présence de trichine. Carcasse(s) à éliminer / saisir.                                                                         |

---

## 3. Acteurs et rôles

### 3.1 Rôles existants impactés

- **CHASSEUR** : examen initial ; prélève en circuit court (rôle métier `PREMIER_DETENTEUR`) ; reçoit les résultats ; transmet au commerce ou au consommateur ; peut retirer une carcasse de la FEI si positif / non-négatif / parasite non identifié.
- **ETG** : vue lecture seule du statut trichine des carcasses qu'il manipule.
- **SVI** : prélève en ETG en circuit agréé ; émet pools + FTP ; reçoit résultats ; **ne peut plus auto-accepter** un sanglier sans résultat négatif ; conditionne décision IPM au résultat.
- **COMMERCE_DE_DETAIL / REPAS_DE_CHASSE_OU_ASSOCIATIF / CANTINE_OU_RESTAURATION_COLLECTIVE / ASSOCIATION_CARITATIVE / CONSOMMATEUR_FINAL** : vue statut trichine ; bloqué pour commercialisation tant que pas de résultat négatif.

### 3.2 Nouveau rôle : `LABORATOIRE`

Ajouts modèle :

- `UserRoles.LABORATOIRE`
- `EntityTypes.LABORATOIRE`
- `Entity.is_lnr: Boolean` — `true` pour l'entité ANSES Maisons-Alfort (LNR unique seedé)

> L'accréditation COFRAC n'est pas tracée en V1 (saisie admin externe à Zacharie). À ajouter en V2 si besoin réglementaire.

`FeiOwnerRole.LABORATOIRE` : NON ajouté — le labo n'est pas owner de la fiche, il accède aux pools via une chaîne séparée.

#### Capacités LVD

- Voit la liste des FTP qui lui ont été envoyées
- Saisit la date de réception
- Refuse un pool individuel ou tous les pools d'une FTP (en masse) → `resultat_analyse = ANALYSE_IMPOSSIBLE` + `raison_refus`
- Saisit le résultat par pool (`NEGATIF` ou `DOUTEUX`), avec saisie en masse possible
- Upload PDF rapport COFRAC via `TrichineDocument`
- Si `DOUTEUX` : génération auto d'une FTP vers LNR + upload photos larves
- **Visibilité stricte** sur les données :
  - Carcasse : numéro d'identification, espèce, date + commune de mise à mort, site de prélèvement
  - Émetteur (1er détenteur ou SVI) : nom + contact (pour facturation et relance)
  - Exclus : historique fiche, autres carcasses, destinataires aval, identité des chasseurs autres que l'émetteur

#### Annuaire LVD

- Pas de self-registration : les LVD ne peuvent pas créer leur entité eux-mêmes
- Seed initial : import de la liste DGAL publique
- Création / mise à jour : action manuelle de l'admin Zacharie qui invite ensuite l'utilisateur initial du LVD
- L'accréditation COFRAC (`accreditation_cofrac`) est saisie manuellement par l'admin lors de la création — pas de validation automatique côté Zacharie (ni à la création, ni en cas d'expiration). L'admin reste responsable de la mise à jour.

#### Capacités LNR (en plus des capacités LVD)

- Reçoit les FTP des pools douteux
- Saisit résultat de confirmation : `NON_NEGATIF` (avec `parasite_identifie`) / `PRESENCE_PARASITE_NON_IDENTIFIE` / `POSITIF`
- Upload PDF rapport COFRAC

### 3.3 Acteurs HORS V1

- **FDC** : centralisation départementale (V2)
- **DDPP / DDETSPP** : interface + notifications (V2)

---

## 4. Modèle de données

Architecture : tables Trichine\* dédiées + extensions des modèles existants (`Carcasse`, `Entity`, enums). On s'aligne sur le schéma de référence (image attachée) en l'adaptant au pattern `User + Entity` existant de Zacharie.

### 4.1 Entités existantes étendues

```prisma
model Entity {
  // ... existant
  type                  EntityTypes  // ajouter LABORATOIRE
  is_lnr                Boolean   @default(false)
}

enum UserRoles {
  // ... existant
  LABORATOIRE
}

enum EntityTypes {
  // ... existant
  LABORATOIRE
}
```

### 4.2 `TrichineEchantillon`

```prisma
model TrichineEchantillon {
  id                    String @id @default(uuid())
  reference_echantillon String @unique // E-{YY}-{séquence}

  zacharie_carcasse_id  String
  preleve_par_user_id   String
  preleve_par_entity_id String? // Entity SVI (agréé, PAS l'ETG) ou Entity PD (court)
  // Le rôle métier (PD vs SVI) est déduit de l'utilisateur, pas de champ dédié

  type             TrichineType            // partagé avec Pool : INITIAL / COMPLEMENTAIRE / CONFIRMATION
  site_prelevement TrichineSitePrelevement
  masse_grammes    Int                     // 5 (initial), 20 (mini-pool), 50 (individuel)
  date_prelevement DateTime @db.Date

  statut           TrichineStatutAnalyse    @default(A_COMPLETER)
  resultat_analyse TrichineResultatAnalyse? // cache hérité du pool

  pool_id     String?  // FK directe (1 échantillon = 1 pool)
  commentaire String?

  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  deleted_at  DateTime?
  is_synced   Boolean   @default(true)
}
```

### 4.3 `TrichinePool` + hiérarchie

```prisma
model TrichinePool {
  id             String @id @default(uuid())
  reference_pool String @unique // P-{YY}-{séquence}

  cree_par_user_id   String
  cree_par_entity_id String? // Entity SVI (agréé) ou Entity PD (court)

  type TrichineType // partagé avec Échantillon

  // Hiérarchie mère / fille / petite-fille (auto-référence)
  pool_parent_id String?

  date_constitution  DateTime  @db.Date
  date_reception     DateTime? // saisie par LVD/LNR à réception
  date_debut_analyse DateTime? @db.Date
  date_fin_analyse   DateTime? @db.Date

  statut             TrichineStatutAnalyse    @default(A_COMPLETER)
  resultat_analyse   TrichineResultatAnalyse?
  parasite_identifie String?                  // rempli si NON_NEGATIF par LNR
  reference_labo     String?                  // n° interne attribué par le labo

  refus_par_user_id String?
  raison_refus      String?
  commentaire       String?

  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  is_synced  Boolean   @default(true)
}
```

### 4.4 `TrichineFTP` + hiérarchie

```prisma
model TrichineFTP {
  id            String    @id @default(uuid())
  numero_fiche  String    @unique // F-{YY}-{séquence}
  date_creation DateTime  @default(now())
  date_envoi    DateTime?

  expediteur_user_id     String
  expediteur_entity_id   String?
  // Le rôle expéditeur (PD / SVI / LVD-vers-LNR) est déduit, pas de champ dédié

  destinataire_entity_id String  // Entity LABORATOIRE (LVD ou LNR)

  // Hiérarchie : FTP LVD → LNR référence la FTP émettrice initiale (auto-référence)
  ftp_parent_id String?

  statut_logistique TrichineStatutLogistiqueFTP @default(BROUILLON)   // enum dédié
  statut_analytique TrichineStatutAnalyse       @default(A_COMPLETER) // partagé Pool/Échantillon

  mode_transport String?
  commentaire    String?

  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  is_synced  Boolean   @default(true)
}
```

### 4.5 Table de jointure `TrichinePoolFTP`

Un pool peut être dans 2 FTP successives (LVD puis LNR). Cette table tracé l'historique des expéditions sans dupliquer le pool.

```prisma
model TrichinePoolFTP {
  id              String   @id @default(cuid())
  pool_id         String
  ftp_id          String
  date_ajout      DateTime @default(now())

  TrichinePool    TrichinePool @relation(fields: [pool_id], references: [id])
  TrichineFTP     TrichineFTP @relation(fields: [ftp_id], references: [id])

  @@unique([pool_id, ftp_id])
}
```

### 4.6 Documents (polymorphique : pool OU ftp)

Une seule table avec deux FK nullables. Un document est attaché soit à un pool, soit à une FTP, jamais aux deux à la fois.

```prisma
model TrichineDocument {
  id                 String   @id @default(uuid())
  // type: String non typé strictement (peut évoluer sans migration)
  // valeurs : "RAPPORT_COFRAC" | "PHOTOGRAPHIE_LARVE" | "FTP_PDF" | "AUTRE" | ...
  type               String
  fichier_url        String   // clé S3 / Cellar
  date_ajout         DateTime @default(now())
  ajoute_par_user_id String

  pool_id String?
  ftp_id  String?

  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?
  is_synced  Boolean   @default(true)
}
```

### 4.7 Notifications (polymorphique)

`type` et `objet_type` en String pour pouvoir étendre sans migration.

```prisma
model TrichineNotification {
  id             String   @id @default(uuid())
  utilisateur_id String   // User Zacharie
  // "RESULTAT_ANALYSE" | "FTP_RECUE" | "POOL_REFUSE" | "CHANGEMENT_STATUT" | ...
  type           String
  // "CARCASSE" | "ECHANTILLON" | "POOL" | "FTP" | ...
  objet_type     String
  objet_id       String
  message        String
  date_creation  DateTime  @default(now())
  lu             Boolean   @default(false)
  date_lecture   DateTime?
}
```

### 4.8 Historique des statuts (polymorphique, audit réglementaire)

```prisma
model TrichineHistoriqueStatut {
  id                  String   @id @default(uuid())
  objet_type          String   // CARCASSE / ECHANTILLON / POOL / FTP / ...
  objet_id            String
  ancien_statut       String
  nouveau_statut      String
  date_changement     DateTime @default(now())
  modifie_par_user_id String
  commentaire         String?
}
```

### 4.9 Champs ajoutés sur `Carcasse` (dénormalisation + flux trichine)

```prisma
model Carcasse {
  // ... existant
  // String (peut évoluer) : "AUCUNE" | "PRELEVEMENT_COMPLEMENTAIRE" | "ANALYSE_EN_COURS_LVD" | "CONFIRMATION_EN_COURS_LNR"
  trichine_action_requise        String?
  consommateur_final_email       String?
  notifier_consommateur          Boolean   @default(false)
  consommateur_notifie_at        DateTime?

  // Retrait FEI en circuit court (champ dédié, distinct de svi_ipm2_decision)
  // En circuit agréé, on utilise svi_ipm2_decision = SAISIE_TOTALE (existant) — pas de doublon.
  trichine_retire_de_fei_at      DateTime?
  trichine_retire_de_fei_motif   String?
  trichine_retire_de_fei_user_id String?
}
```

> Le retrait de la FEI **ne supprime pas la carcasse** : elle reste en base, visible dans le registre + exports avec mention « Retirée pour trichine le ... — motif : ... ». Elle est exclue des cessions futures.
>
> **`trichine_action_requise`** remplace l'idée de `statut_metier` plus large : c'est un signal clair pour l'UX (carte carcasse) sur l'action attendue de l'utilisateur. Le statut métier transversal (À compléter / En cours / Terminées) reste calculé dynamiquement depuis les échantillons + pools, pas persisté sur Carcasse.

### 4.10 Enums

Stratégie : **5 enums** pour les valeurs réglementaires/stables. Tout le reste en **String** pour itérer sans migration Postgres.

```prisma
// Type partagé Échantillon + Pool (mêmes valeurs réglementaires)
enum TrichineType {
  INITIAL
  COMPLEMENTAIRE
  CONFIRMATION
}

// Statut analytique partagé Échantillon / Pool / FTP
enum TrichineStatutAnalyse {
  A_COMPLETER
  EN_COURS_ANALYSES
  ANALYSES_TERMINEES
}

enum TrichineSitePrelevement {
  PILIER_DIAPHRAGME
  LANGUE
  MEMBRE_ANTERIEUR
}

enum TrichineStatutLogistiqueFTP {
  BROUILLON
  ENVOYEE
  RECUE
  TRAITEE
}

enum TrichineResultatAnalyse {
  NEGATIF
  DOUTEUX
  ANALYSE_IMPOSSIBLE
  NON_NEGATIF
  PRESENCE_PARASITE_NON_IDENTIFIE
  POSITIF
}
```

**Champs typés `String` (évolutifs)** avec valeurs conventionnelles documentées en code :

| Champ                                                                      | Valeurs attendues                                                                              |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Carcasse.trichine_action_requise`                                         | `AUCUNE` / `PRELEVEMENT_COMPLEMENTAIRE` / `ANALYSE_EN_COURS_LVD` / `CONFIRMATION_EN_COURS_LNR` |
| `TrichineDocument.type`                                                    | `RAPPORT_COFRAC` / `PHOTOGRAPHIE_LARVE` / `FTP_PDF` / `AUTRE`                                  |
| `TrichineNotification.type`                                                | `RESULTAT_ANALYSE` / `FTP_RECUE` / `POOL_REFUSE` / `CHANGEMENT_STATUT`                         |
| `TrichineNotification.objet_type` et `TrichineHistoriqueStatut.objet_type` | `CARCASSE` / `ECHANTILLON` / `POOL` / `FTP`                                                    |

**Champs supprimés** (par rapport aux versions précédentes du doc) :

- `type_history Json[]` sur Échantillon et Pool — l'audit est dans `TrichineHistoriqueStatut`
- `preleve_par_role` sur Échantillon, `expediteur_role` sur FTP — déduits de l'utilisateur
- `Entity.accreditation_cofrac` — saisie hors Zacharie en V1
- `masse MasseEchantillon` enum → `masse_grammes Int` (5, 20, 50)

**Décision IPM** : on utilise `IPM2Decision` (déjà existant sur `Carcasse.svi_ipm2_decision`), valeurs `SAISIE_TOTALE` / `TRAITEMENT_ASSAINISSANT`. Pas de nouvel enum.

### 4.11 Recalcul des statuts

Le **statut métier** (`statut` sur Échantillon, Pool, FTP analytique, `statut_logistique` sur FTP, `trichine_action_requise` carcasse) est **persisté** et recalculé via fonctions utilitaires explicites appelées dans les controllers :

- `recomputeCarcasseTrichine(carcasse_id)` — calcule `trichine_action_requise` et propage `resultat_analyse` final
- `recomputeEchantillonTrichine(echantillon_id)` — calcule `statut` à partir du pool parent
- `recomputePoolTrichine(pool_id)` — calcule `statut` à partir des résultats + pools enfants
- `recomputeFTPTrichine(ftp_id)` — calcule `statut_logistique` (envoi/réception) et `statut_analytique` (résultats des pools)

Règle pool mère : un pool ne peut pas être `ANALYSES_TERMINEES` tant qu'au moins un pool fille / petite-fille est `EN_COURS_ANALYSES`. La fonction `recomputePoolTrichine` parcourt la hiérarchie complète.

Chaque changement de statut alimente automatiquement `TrichineHistoriqueStatut`.

Le **statut utilisateur** (À faire / En cours / Clôturé) est **calculé dynamiquement** par utilisateur et par objet (côté backend, exposé via endpoint dédié). Pas de persistance. Règles :

| Objet                      | À faire                                                               | En cours                              | Clôturé                                             |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| Carcasse (chasseur/SVI)    | Sanglier sans échantillon, ou `trichine_action_requise` ≠ null/AUCUNE | Échantillon créé, en attente résultat | Résultat final connu + action décidée               |
| Échantillon (chasseur/SVI) | Créé, pas dans un pool                                                | Dans pool envoyé, en attente          | Résultat connu                                      |
| Pool (émetteur)            | Créé, pas dans une FTP                                                | Dans FTP envoyée, en attente          | `statut` = ANALYSES_TERMINEES                       |
| FTP (émetteur)             | BROUILLON                                                             | ENVOYEE ou RECUE                      | TRAITEE et `statut_analytique` = ANALYSES_TERMINEES |
| FTP (LVD/LNR)              | RECUE, résultats non saisis                                           | Saisie en cours                       | TRAITEE                                             |

---

## 5. Flows métier

### 5.1 Circuit agréé (SVI en ETG)

```
Carcasses sangliers arrivent en ETG
        ↓
SVI prélève sur chaque sanglier (échantillon INITIAL, 5g, site)
Carcasses CONSIGNÉES par défaut (sanglier sans résultat = blocage IPM)
        ↓
SVI crée un POOL INITIAL (max 19 carcasses, mix 1ers détenteurs OK en agréé)
        ↓
SVI crée une FTP (peut regrouper plusieurs pools)
SVI passe la FTP de BROUILLON à ENVOYEE (génération PDF Zacharie)
        ↓
LVD reçoit notification, saisit date réception → FTP passe à RECUE
LVD analyse et saisit resultat_analyse par pool
        ├─ NEGATIF → notification SVI → IPM autorisée
        ├─ ANALYSE_IMPOSSIBLE → SVI doit prélever à nouveau
        └─ DOUTEUX → notification SVI + génération auto FTP vers LNR
              ↓
        ┌────┴────────────────────────────────┐
   En parallèle :                              ↓
   ① SVI prélève à nouveau               LNR analyse pool douteux
      → pool fille COMPLEMENTAIRE             (+ photos LVD)
        (max 4 carcasses du pool mère,        ↓
         20g/carcasse)                    ② Résultat LNR :
      → envoi LVD via nouvelle FTP          - NON_NEGATIF (autre parasite + nom)
      → si fille DOUTEUX :                  - PRESENCE_PARASITE_NON_IDENTIFIE
        pool petite-fille (1 carcasse, 50g) - POSITIF (trichine)
        ↓
   Identification carcasse incriminée
        ↓
   Décision IPM SVI sur Carcasse.decision_ipm :
   - POSITIF                          → SAISIE_TOTALE
   - NON_NEGATIF                      → SAISIE_TOTALE ou TRAITEMENT_ASSAINISSANT
   - PRESENCE_PARASITE_NON_IDENTIFIE  → décision au cas par cas
   - Si non identifiée : décision sur TOUT le pool initial
```

### 5.2 Circuit court (1er détenteur)

```
Chasseur fait examen initial
        ↓
1er détenteur prélève sur chaque sanglier (échantillon INITIAL)
Carcasses CONSERVÉES (chez lui, ou chez commerce détail qui ne commercialise pas)
        ↓
1er détenteur crée un POOL INITIAL (max 19 carcasses, UNIQUEMENT siennes en V1)
        ↓
1er détenteur crée une FTP (peut regrouper plusieurs pools)
1er détenteur passe FTP de BROUILLON à ENVOYEE (génération PDF Zacharie)
        ↓
Pendant l'attente :
- Cession à un tiers POSSIBLE (statut En cours d'analyses + avertissement)
- Le tiers (commerce détail) reçoit notification du statut et ne peut pas commercialiser
        ↓
LVD analyse, saisit date réception, saisit resultat_analyse
        ├─ NEGATIF → notification 1er détenteur + tous destinataires actuels
        │           → carcasse passe en Analyses terminées : négatif
        │           → commerce peut commercialiser
        ├─ ANALYSE_IMPOSSIBLE → équivalent absence d'analyse
        └─ DOUTEUX → notification + FTP auto vers LNR
              ↓
   En parallèle (1er détenteur peut RENONCER) :
   ① 1er détenteur reprélève → pool fille → LVD → éventuellement petite-fille
   ② LNR confirme : NON_NEGATIF / PRESENCE_PARASITE_NON_IDENTIFIE / POSITIF
        ↓
   Action 1er détenteur :
   - Option A : Réaliser les analyses 2e intention (mini-pool / individuel)
   - Option B : Renoncer aux analyses 2e intention (workflow dédié)
     * Bouton "Renoncer aux analyses 2e intention" dans détail pool douteux
     * Modal de confirmation
     * Au clic : pour chaque carcasse du pool, mise à trichine_retire_de_fei_at
       + motif auto "Renoncement analyses 2e intention pool #X"
     * Notification automatique destinataires actuels
   - Si carcasse identifiée comme incriminée (cas A) :
     * 1er détenteur retire la carcasse via bouton dédié
     * Champ trichine_retire_de_fei_at + motif obligatoire
     * Les autres carcasses du pool peuvent être libérées (résultat négatif final)
   - Élimination physique = responsabilité 1er détenteur (Zacharie trace l'intention)
```

### 5.3 Hiérarchie pools / échantillons / FTP

```
Carcasse (1..n échantillons)
    └─ Échantillon initial #E1 (pool_id = #P1)
         └─ Pool initial #P1 (1..19 échantillons)
              ├─ FTP #F1 (1er envoi LVD)
              │    └─ LVD donne resultat_analyse = NEGATIF | DOUTEUX | ANALYSE_IMPOSSIBLE sur P1
              │
              ├─ Si DOUTEUX :
              │    └─ FTP #F2 (auto, expediteur=LVD, destinataire=LNR)
              │         └─ Pool P1 (même entité, dans TrichinePoolFTP avec F1 ET F2)
              │              └─ LNR donne resultat_analyse = NON_NEGATIF | POSITIF | PRESENCE_PARASITE_NON_IDENTIFIE
              │
              └─ Si analyses 2e intention :
                   ├─ Échantillons complémentaires (nouveaux prélèvements)
                   │    └─ Pool fille #P2 (max 4 carcasses du P1, pool_parent_id = #P1, type COMPLEMENTAIRE)
                   │         └─ FTP #F3 (PD/SVI → LVD)
                   │              └─ Résultat
                   │                   └─ Si DOUTEUX :
                   │                        ├─ Pool petite-fille #P3 (1 carcasse, 50g, pool_parent_id = #P2)
                   │                        │    └─ FTP #F4 → LVD
                   │                        └─ ...
```

Règle : un pool mère ne peut pas passer en `ANALYSES_TERMINEES` tant qu'au moins une fille / petite-fille est `EN_COURS_ANALYSES`.

---

## 6. Écrans et parcours

### 6.1 Chasseur / 1er détenteur (mobile)

**Carte carcasse** (existant, ajout section trichine)

- Bandeau statut métier + statut utilisateur
- `action_requise` mise en avant si différent de `AUCUNE`
- Bouton "Réaliser un échantillon"
- Liste des échantillons + pools + FTP associés
- Chronologie des événements (depuis HistoriqueStatut)

**Création d'un échantillon**

- Site prélèvement (pré-sélection : préférence user dans profil)
- Masse (`CINQ_GRAMMES` par défaut pour INITIAL ; auto pour les autres types)
- Date prélèvement (auto = aujourd'hui, modifiable)
- Validation → `reference_echantillon` auto

**Mes pools**

- Liste des pools avec statut métier + utilisateur
- CTA "Créer un nouveau pool"

**Création d'un pool**

- Sélection des échantillons à grouper (jusqu'à 19, total max 100 g)
- Validation → `reference_pool` auto

**Création d'une FTP**

- Sélection pools à envoyer
- Sélection LVD (annuaire Entity LABORATOIRE ; LVD préféré pré-sélectionné dans profil)
- Date d'envoi
- Mode de transport
- Génération PDF FTP → upload dans `TrichineDocument` lié via `FTPDocument`
- Possibilité d'imprimer

**Mes FTP + détail FTP**

- Liste avec statut logistique + analytique
- Téléchargement PDF FTP
- Téléchargement PDF rapports (quand reçus)

**Détail pool douteux** (après résultat LVD `DOUTEUX`)

- Bandeau orange + statut + résumé pool
- Bouton principal : "Réaliser des prélèvements 2e intention" → workflow pool fille / petite-fille
- Bouton secondaire : "Renoncer aux analyses 2e intention" → modal confirmation → marque toutes les carcasses du pool comme retirées avec motif auto

**Détail carcasse avec résultat**

- Si `POSITIF` / `NON_NEGATIF` / `PRESENCE_PARASITE_NON_IDENTIFIE` :
  - Bandeau rouge
  - Bouton "Retirer cette carcasse de la FEI" (modal avec saisie de motif obligatoire)
  - Si déjà cédée : avertissement "Notifier le destinataire actuel"
- Si carcasse déjà retirée : affichage "Retirée le ... — Motif : ..." (lecture seule)

### 6.2 SVI (desktop)

Mêmes écrans que chasseur, adaptés au flux ETG :

- Création échantillon depuis fiche IPM
- **Auto-acceptation sanglier désactivée** : Zacharie bloque l'IPM tant qu'aucun résultat négatif n'est associé à la carcasse

**Intégration IPM1/IPM2** :

- Bandeau statut trichine en haut de carcasse sanglier
- Si pas de résultat NEGATIF → bouton "Accepter" désactivé
- Si `POSITIF` → suggestion `decision_ipm = SAISIE_TOTALE` auto
- Si `NON_NEGATIF` → choix `SAISIE_TOTALE` ou `TRAITEMENT_ASSAINISSANT`

### 6.3 LVD (desktop, nouveau)

Routes `/laboratoire/*` :

- `/laboratoire/ftp` : liste des FTP reçues (filtres : à traiter / en cours / clôturées)
- `/laboratoire/ftp/:id` :
  - Détail composition (pools, échantillons, carcasses, dates/communes mise à mort, sites prélèvement)
  - Saisie date de réception → `statut_logistique = RECUE`
  - Pour chaque pool : sélection résultat + dates analyse + commentaire + upload PDF
  - Action "Refuser pool(s)" → `resultat_analyse = ANALYSE_IMPOSSIBLE` + `raison_refus` (saisie en masse possible)
  - Action "Saisir résultat" → `NEGATIF` ou `DOUTEUX`
  - Si `DOUTEUX` : modal pour upload photos larves → génération auto FTP vers LNR
- `/laboratoire/profil/*` : coordonnées, accréditation, utilisateurs

### 6.4 LNR (mêmes routes que LVD)

- Filtre auto : voit uniquement les FTP qui lui sont destinées (`destinataire_entity_id` = LNR)
- Saisie résultat de confirmation : `NON_NEGATIF` (avec `parasite_identifie`) / `PRESENCE_PARASITE_NON_IDENTIFIE` / `POSITIF`

### 6.5 ETG (desktop)

Bandeau statut trichine sur chaque carcasse sanglier en consigne. Lecture seule.

### 6.6 Commerce détail / repas asso / cantine / asso caritative

- Bandeau statut trichine par carcasse sanglier reçue
- Si `EN_COURS_ANALYSES`, `DOUTEUX`, `POSITIF`, `NON_NEGATIF`, `PRESENCE_PARASITE_NON_IDENTIFIE` : bandeau rouge "Ne pas commercialiser"
- Si `NEGATIF` : bandeau vert + lien téléchargement PDF rapport
- Notification push / email quand résultat arrive

### 6.7 Consommateur final

Trois cas de réception de l'info :

1. Sur Zacharie (si compte) : statut trichine visible
2. Par le 1er détenteur (papier, hors Zacharie)
3. Par email Zacharie : si carcasse statut « absence d'analyse » ET `notifier_consommateur = true` ET `consommateur_final_email` renseigné → envoi automatique du message cuisson 71°C, horodaté dans `consommateur_notifie_at`

---

## 7. Notifications

Toutes les notifications sont persistées dans `TrichineNotification` (table polymorphique) en plus du push / email immédiat.

| Événement                                                              | Destinataires                                                    | Type Notification                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| FTP envoyée par PD/SVI vers LVD                                        | LVD destinataire (tous users de l'Entity)                        | `FTP_RECUE`                           |
| FTP reçue (date réception saisie par LVD)                              | Émetteur                                                         | `CHANGEMENT_STATUT`                   |
| Résultat NEGATIF saisi par LVD                                         | Émetteur + 1ers détenteurs des carcasses + destinataires actuels | `RESULTAT_ANALYSE`                    |
| Résultat DOUTEUX saisi par LVD                                         | Émetteur + LNR (immédiate, alerte)                               | `RESULTAT_ANALYSE`                    |
| Résultat ANALYSE_IMPOSSIBLE                                            | Émetteur                                                         | `POOL_REFUSE`                         |
| FTP générée auto LVD → LNR                                             | LNR                                                              | `FTP_RECUE`                           |
| Résultat LNR (POSITIF, NON_NEGATIF, PRESENCE_PARASITE_NON_IDENTIFIE)   | LVD + émetteur initial (PD/SVI) + destinataires actuels (court)  | `RESULTAT_ANALYSE` (alerte sanitaire) |
| Cession sanglier sans échantillon (rappel)                             | Chasseur                                                         | `CHANGEMENT_STATUT`                   |
| Carcasse sanglier sans analyse cédée à conso final (si option activée) | Consommateur final (email uniquement, pas de notif app)          | n/a                                   |

---

## 8. Message d'information consommateur

Texte standardisé exact :

> « Le sanglier peut être porteur d'un parasite : la trichine. C'est pourquoi la viande de sanglier doit toujours être bien cuite à cœur ! »

Modalités :

- Email automatique Zacharie envoyé au consommateur final si :
  - Carcasse sanglier statut « absence d'analyse »
  - `notifier_consommateur = true` sur la carcasse
  - `consommateur_final_email` renseigné
- Affichage sur Zacharie dans la vue carcasse du consommateur (si compte)
- Trace : `Carcasse.consommateur_notifie_at`

---

## 9. Règles de validation et blocages

| Situation                                                                                           | Comportement                                                                              |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Cession sanglier circuit court SANS échantillon                                                     | Avertissement fort non bloquant : modal + case "j'engage ma responsabilité" + trace       |
| Cession sanglier en cours d'analyses                                                                | Cession autorisée + notification statut au destinataire                                   |
| Cession sanglier avec carcasse statut `POSITIF` / `NON_NEGATIF` / `PRESENCE_PARASITE_NON_IDENTIFIE` | Bloqué : "Carcasse impropre à la consommation, cession impossible. Retirez-la de la FEI." |
| SVI tente d'accepter un sanglier sans résultat NEGATIF (agréé)                                      | Bloqué : "Recherche trichine obligatoire avant acceptation"                               |
| Pool > 19 carcasses ou échantillons > 100 g (initial)                                               | Bloqué                                                                                    |
| Pool fille avec > 4 carcasses du pool mère                                                          | Bloqué                                                                                    |
| Pool fille avec carcasses hors pool mère                                                            | Bloqué                                                                                    |
| Pool petite-fille avec ≠ 1 carcasse ou < 50 g                                                       | Bloqué                                                                                    |
| Tentative pool mère ANALYSES_TERMINEES si fille / petite-fille EN_COURS                             | Bloqué (recalcul statut)                                                                  |
| 1er détenteur retire une carcasse de la FEI                                                         | Champ `trichine_retire_de_fei_at` + motif obligatoire + notif destinataires actuels       |

Tous les passages outre tracent : timestamp, user_id, case cochée.

---

## 10. Permissions

Intégration dans `api-express/src/utils/carcasse-access.ts` + `fei-access.ts` (branche `feat--add-permission-carcasse`).

### 10.1 Nouveaux rôles d'accès

- `LVD` : labo agréé destinataire d'une FTP contenant cette carcasse (via `TrichinePoolFTP`)
- `LNR` : LNR destinataire d'une FTP contenant cette carcasse

### 10.2 Règles

- **LVD / LNR** : `canView = true` avec **projection stricte**
  - Carcasse : `numero_identification`, `espece`, `date_mise_a_mort`, `commune_mise_a_mort`, `site_prelevement` (de l'échantillon)
  - Émetteur : nom + contact (facturation / relance)
  - Exclus : historique fiche, autres carcasses, destinataires aval, identité chasseurs autres que émetteur
  - Implémentation : endpoints dédiés `/laboratoire/*` qui renvoient une projection construite côté serveur (pas de reuse de `/carcasse/:id`)
- **LVD / LNR** : `canEdit = true` uniquement sur les champs résultat du pool (pas sur la carcasse)
- **CHASSEUR (1er détenteur)** : capacité étendue de retrait carcasse FEI si résultat positif / non-négatif / parasite non identifié — mutation dédiée `POST /carcasse/:id/retirer-de-fei`

### 10.3 Endpoints dédiés

- `GET /laboratoire/ftp` / `/laboratoire/ftp/:id`
- `POST /laboratoire/ftp/:id/reception`
- `POST /laboratoire/pool/:id/resultat`
- `POST /laboratoire/pool/:id/refuser`
- `POST /laboratoire/pool/:id/documents` (upload PDF rapport)
- `POST /laboratoire/ftp/:id/photos` (LVD upload photos larves pour LNR)
- `POST /trichine/echantillon`
- `POST /trichine/pool`
- `POST /trichine/ftp`
- `POST /trichine/pool/:id/renoncer-2e-intention`
- `POST /carcasse/:id/retirer-de-fei`
- `GET /trichine/notifications` (user-scoped)

---

## 11. Questions ouvertes restantes

### Importants

1. **NotificationCarcasse pendant cession multiple** : si un commerce détail reçoit 10 sangliers et qu'1 seul résultat tombe en POSITIF, notif unique groupée ou 10 notifs ? (À trancher après premiers retours utilisateurs.)

### Mineurs

2. **Délai max envoi échantillon → LVD** : conservation max ? Alerte si > X jours ?
3. **Notif LVD/LNR urgent** : email seul suffit, ou SMS pour DOUTEUX ?
4. **Date d'envoi vs date de prélèvement** : écart max autorisé ?
5. **Cas usage domestique privé** : créer une "fiche fictive" pour tracer l'analyse, ou parcours simplifié hors FEI ?
6. **Auto-fermeture de FTP** : `statut_logistique` passe-t-il automatiquement à `TRAITEE` quand tous les résultats sont saisis, ou action manuelle LVD ?
7. **Durée de rétention des PDF rapports COFRAC côté chasseur** : à confirmer (5 ans côté labo, indéterminée côté chasseur).

---

## 12. Infrastructure technique

### 12.1 Génération PDF FTP

- **Approche** : HTML → PDF via **Puppeteer** côté serveur. Jamais de génération directe en PDF.
- Pipeline :
  1. Construction du HTML de la FTP (avec CSS inline) côté backend
  2. Chromium (via Puppeteer) « imprime » le HTML en PDF
  3. Upload du PDF vers le bucket Cellar (cf §12.2)
  4. Référence stockée dans `TrichineDocument` (type `FTP_PDF`) + liaison via `FTPDocument`
- Avantage : maintenance facile (édition HTML/CSS), rendu fidèle, possibilité de prévisualiser le HTML brut
- Modèle visuel à fournir par DGAL — template HTML à créer une fois le modèle reçu

### 12.2 Stockage des documents

- **Backend** : Object Storage **Cellar** (Clever Cloud, compatible S3)
- Utilisé pour :
  - PDF FTP générées par Zacharie (type `FTP_PDF`)
  - PDF rapports COFRAC uploadés par les LVD/LNR (type `RAPPORT_COFRAC`)
  - Photographies de larves uploadées par les LVD (type `PHOTOGRAPHIE_LARVE`)
- Convention de clé : `trichine/{type}/{annee}/{id-document}.{ext}`
- URL pré-signée (expiration ~1h) pour téléchargement utilisateur

## 13. Roadmap d'implémentation (post-validation spec)

Découpe en PRs distinctes.

| Phase                                         | Livrable                                                                                                                                                                                                                      | Dépendances                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **P1 — Modèle**                               | Migrations Prisma : extensions Entity, TrichineEchantillon, TrichinePool, TrichineFTP, TrichinePoolFTP, TrichineDocument + PoolDocument + FTPDocument, TrichineNotification, TrichineHistoriqueStatut, enums, champs Carcasse | —                                          |
| **P2 — Permissions**                          | Intégration `LVD` / `LNR` dans `getCarcasseAccess` / `getFeiAccess` ; règle de projection limitée                                                                                                                             | `feat--add-permission-carcasse` mergé + P1 |
| **P3 — Backend core**                         | Controllers `/trichine/*`, `/laboratoire/*` ; fonctions `recompute*` ; alimentation auto historique + notifications                                                                                                           | P1 + P2                                    |
| **P4 — Génération PDF FTP**                   | Génération côté serveur du PDF FTP (modèle DGAL) ; stockage `TrichineDocument`                                                                                                                                                | P3                                         |
| **P5 — Frontend 1er détenteur**               | Écrans échantillon, pool, FTP, suivi, retrait carcasse de FEI                                                                                                                                                                 | P3 + P4                                    |
| **P6 — Frontend LVD**                         | Layout + écrans FTP / pool / saisie résultat / upload PDF / refus                                                                                                                                                             | P3                                         |
| **P7 — Frontend LNR**                         | Filtre LNR + saisie confirmation + upload photographies                                                                                                                                                                       | P6                                         |
| **P8 — Frontend SVI agréé**                   | Création échantillon / pool / FTP en ETG ; blocage auto-acceptation sanglier ; intégration IPM1/IPM2                                                                                                                          | P3                                         |
| **P9 — Frontend destinataires circuit court** | Bandeaux statut trichine, blocage commercialisation visuelle                                                                                                                                                                  | P3                                         |
| **P10 — Email conso final cuisson**           | Activation 1er détenteur + envoi auto                                                                                                                                                                                         | P3                                         |
| **P11 — Workflow analyses 2e intention**      | Création pool fille / petite-fille ; workflow renoncement                                                                                                                                                                     | P5 + P6                                    |
| **P12 — Seed LVD + invitation utilisateurs**  | Import annuaire DGAL ; UI admin pour invitation                                                                                                                                                                               | P1                                         |
| **P13 — Tests & E2E**                         | Couverture circuit court complet + agréé complet + LVD/LNR                                                                                                                                                                    | toutes                                     |

---

## Annexes

### Décisions tranchées en amont de cette V1

**Structurelles (modèle)** :

- Périmètre : circuit court + circuit agréé (ETG/SVI)
- Format des résultats : enum unifié `TrichineResultatAnalyse` directement sur Pool (cache hérité sur Échantillon), pas de table dédiée
- Notification + Historique statut : tables polymorphiques génériques (audit réglementaire) — `type` et `objet_type` en String
- Pool → FTP : table de jointure `TrichinePoolFTP` (un pool peut être dans 2 FTP successives : LVD puis LNR)
- Échantillon → Pool : FK directe `pool_id` (1 échantillon = 1 pool en pratique)
- Documents : table `TrichineDocument` polymorphique avec `pool_id?` + `ftp_id?` (un seul des deux à la fois) — pas de tables de jointure intermédiaires
- Modèle utilisateur : pattern Zacharie existant `User + Entity` (rôle `LABORATOIRE`, flag `is_lnr` sur Entity)
- Recalcul statuts : fonctions utilitaires explicites dans les controllers (pas de Prisma middleware)

**Stratégie typage (simplification V1)** : seuls les enums réglementaires/stables sont typés (5 enums : `TrichineType`, `TrichineStatutAnalyse`, `TrichineSitePrelevement`, `TrichineStatutLogistiqueFTP`, `TrichineResultatAnalyse`). Tous les autres champs "UX" sont des `String` (action_requise carcasse, types document/notif, objet polymorphique). Cela permet d'itérer le métier sans migration Postgres (chaque ajout d'enum = `ALTER TYPE` + déploiement). Le typage strict pourra revenir une fois les valeurs stabilisées en production.

**Formats et conventions** :

- `reference_echantillon` : `E-{YY}-{séquence}` (ex : `E-26-000123`)
- `reference_pool` : `P-{YY}-{séquence}` (ex : `P-26-000045`)
- `numero_fiche` : `F-{YY}-{séquence}` (ex : `F-26-000012`)
- Prélèvement en circuit agréé : `preleve_par_entity_id` = Entity SVI (pas ETG)
- Retrait carcasse FEI en circuit agréé : pas de champ dédié, on utilise `decision_ipm = SAISIE_TOTALE` (l'info trichine est portée par le résultat lié)

**Annuaire et processus** :

- Annuaire LVD : seed initial DGAL + création par admin Zacharie uniquement (pas de self-registration)
- Accréditation COFRAC : saisie manuelle admin, pas de validation auto Zacharie
- Visibilité LVD / LNR : projection stricte (carcasse minimale + émetteur)

**Workflows** :

- Renoncement aux analyses 2e intention : workflow explicite "Je renonce" en circuit court
- Retrait carcasse de FEI en circuit court : champ dédié `trichine_retire_de_fei_at` + motif (distinct de `decision_ipm`)

**Infrastructure** :

- Génération PDF FTP : HTML → PDF via Puppeteer côté serveur
- Stockage documents : Object Storage Cellar (Clever Cloud, S3-compatible)

**HORS V1** :

- Arrêtés préfectoraux
- FDC (centralisation départementale)
- Interface DDPP/DDETSPP + notifications autorités
- Surveillance territoriale, vue admin agrégée
- API d'interconnexion avec systèmes traçabilité internes des labos
