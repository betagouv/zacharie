# Zacharie

Application de traçabilité du gibier sauvage, de la chasse à la consommation. Projet [beta.gouv.fr](https://beta.gouv.fr).

## Le besoin

La réglementation française impose une traçabilité sanitaire du gibier sauvage (venaison) tout au long de la chaîne alimentaire. Zacharie numérise ce processus en remplaçant les fiches papier par une application utilisable sur le terrain.

### Acteurs concernés

- **Chasseurs** — Réalisent l'examen initial des carcasses sur le terrain
- **Collecteurs professionnels** — Assurent le transport et le regroupement des carcasses
- **ETG (Établissements de Traitement du Gibier)** — Transforment les carcasses
- **SVI (Services Vétérinaires d'Inspection)** — Contrôlent la conformité sanitaire
- **Commerces de détail** — Vendent la venaison au consommateur final

### Fiche d'Examen Initial (FEI)

Document central de l'application. Chaque FEI suit le parcours d'une ou plusieurs carcasses de gibier : identification de l'animal, examen sanitaire, chaîne de détention, décisions vétérinaires.

## Architecture

Monorepo TypeScript avec architecture **local-first** pour un usage hors-ligne robuste.

```
zacharie/
├── api-express/                        # API backend (Express + Prisma + PostgreSQL)
├── app-local-first-react-router/       # Application web (React 19 + React Router 7 + Vite)
├── expo/                               # Application mobile (Expo / WebView)
├── e2e/                                # Tests end-to-end (Playwright)
├── materialized-views/                 # Vues matérialisées PostgreSQL
└── doc/                                # Documentation projet
```

### Backend — `api-express/`

- **Express** avec **Prisma** ORM sur PostgreSQL
- Authentification JWT (app interne) et clé API (API publique v1)
- API publique en lecture seule pour les partenaires tiers (`/v1/`)
- Swagger docs à `/v1/docs/`

### Frontend — `app-local-first-react-router/`

- **React 19** + **React Router 7** + **Vite**
- **DSFR** (Système de Design de l'État) via `@codegouvfr/react-dsfr`
- **Tailwind CSS** pour le styling complémentaire
- **Local-first** : données stockées en IndexedDB via Zustand, synchronisation asynchrone avec le serveur
- Service worker pour le support hors-ligne

### Mobile — `expo/`

- **Expo (React Native)** encapsulant l'application web dans une WebView
- Distribution sur iOS et Android sans code natif spécifique

### Synchronisation local-first

Les modifications sont appliquées localement d'abord (`is_synced = false`), puis synchronisées via une file d'attente (PQueue, concurrence 1). Résolution de conflits par comparaison de `updated_at` (le plus récent gagne).

## Prérequis

- **Node.js** >= 20
- **PostgreSQL**
- **npm**

## Installation

```bash
git clone <url-du-repo>
cd zacharie
```

### Variables d'environnement

**API** (`api-express/`) :

```
POSTGRESQL_ADDON_URI=postgresql://user:password@localhost:5432/zacharie
```

**E2E** (`e2e/`) :

```
PGBASEURL=postgresql://user:password@localhost:5432
PGDATABASE=zacharietest
```

### Lancement

```bash
# API (port 3235)
cd api-express
npm install
npm run dev

# Frontend (port 3234)
cd app-local-first-react-router
npm install
npm run dev

# Mobile
cd expo
npm install
npm run start
```

## Tests

### Tests unitaires

```bash
# API
cd api-express && npm run test

# Frontend
cd app-local-first-react-router && npm run vitest
```

### Tests E2E (Playwright)

```bash
cd e2e
npm install
npm run test:init-db          # Initialiser la base de test (première fois)
npx playwright test           # Lancer tous les tests
npx playwright test <file>    # Lancer un fichier spécifique
```

Comptes de test : `admin1@example.org` à `admin12@example.org`, mot de passe : `secret`

## Commandes utiles

| Package                        | Commande            | Description                |
| ------------------------------ | ------------------- | -------------------------- |
| `api-express`                  | `npm run dev`       | Serveur de dev (port 3235) |
| `api-express`                  | `npm run test`      | Tests Vitest               |
| `api-express`                  | `npm run typecheck` | Vérification TypeScript    |
| `api-express`                  | `npm run format`    | Formatage Prettier         |
| `app-local-first-react-router` | `npm run dev`       | Serveur Vite (port 3234)   |
| `app-local-first-react-router` | `npm run vitest`    | Tests Vitest               |
| `app-local-first-react-router` | `npm run lint`      | ESLint                     |
| `app-local-first-react-router` | `npm run typecheck` | Vérification TypeScript    |
| `app-local-first-react-router` | `npm run build`     | Build de production        |
| `expo`                         | `npm run start`     | Serveur Expo               |
| `expo`                         | `npm run ios`       | Simulateur iOS             |
| `expo`                         | `npm run android`   | Émulateur Android          |

## Licence

[Apache License 2.0](LICENSE)
