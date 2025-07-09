## Tests

Les tests sont faits avec [playwright](https://playwright.dev/).

### Préparation

Pour faire fonctionner les tests en local, installer NodeJS et PostgreSQL et installer l'extension [VSCode Playwright](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) (recommandée).

Mettre dans un `.env` du dossier `zacharie/e2e` l'URL de la base de données:

```
PGBASEURL=postgres://localhost:5432
```

Initialiser la base de données `zacharietest`:

```bash
# Depuis le dossier zacharie/e2e
npm i && npm run test:init-db
```

### Lancer les tests en local

Lancer les tests directement depuis l'interface de VSCode (lancer la commande `Testing: Focus on Playwright View`), qui se charge de lancer les serveurs nécessaires. On peut lancer l'ensemble ou seulement un test.

ATTENTION: vous devez ouvrir VSCode depuis le dossier `./e2e` pour que ça fonctionne (désolé)

### Créer des nouveaux tests

Pour aller plus vite à la création de tests, on utilise le recorder de Playwright, lançable directement depuis l'interface de VSCode. Il faut pour l'instant lancer les serveurs à la main, ça devrait être amélioré dans [une prochaine version](https://github.com/microsoft/playwright/issues/18290#issuecomment-1289734778).

```bash
# Directement depuis le dossier mano
npm run test:start-app-for-record
npm run test:start-api-for-record
```

Ensuite lancer la commande `Record new` depuis VSCode. Pour chaque test, on peut utiliser un des 12 admins.

- Email : `admin1@example.org`, `admin2@example.org`, etc.
- Mot de passe : `secret`

