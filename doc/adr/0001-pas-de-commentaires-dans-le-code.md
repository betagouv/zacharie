# 0001. Pas de commentaires dans le code

## Contexte

Les commentaires du code tombaient dans quatre catégories :

- **tautologie** : ils répètent ce que le code dit déjà ;
- **périmé** : ils décrivent du code ou un comportement qui n'existe plus ;
- **excuse** : ils justifient un contournement, qui est ensuite recopié ailleurs (par un humain ou un agent) ;
- **décision** : ils expliquent un choix important et non évident.

Seule la dernière catégorie a de la valeur, et elle est mieux rangée hors du code, regroupée par sujet.

## Décision

- Le code ne contient pas de commentaires. Seules les directives d'outils sont permises (`eslint-disable`, `@ts-expect-error`, `prettier-ignore`, `/// <reference>`…). La liste exacte est `ALLOWED_DIRECTIVES` dans `eslint.comments.config.js`.
- Les décisions vont dans un ADR de ce dossier.
- Les contournements à corriger vont dans [excuses-a-traiter.md](excuses-a-traiter.md).
- La règle tourne via `npm run lint:comments` dans `api-express/` et `app-local-first-react-router/` (config dédiée `eslint.comments.config.js`, séparée du `npm run lint` existant), en CI dans `tests.yml`.
- Tous les commentaires existants ont été supprimés d'un coup (novembre 2026) : la règle est active partout, sans liste d'exceptions. Pour un futur nettoyage partiel, utiliser les suppressions groupées d'ESLint (`--suppress-rule`, puis `--prune-suppressions`) plutôt que désactiver la règle.
- Dans le `npm run lint` habituel, `no-empty` autorise un `catch {}` vide : ces blocs portaient souvent un simple commentaire « on ignore ».
- Le skill `/delete-comment` (`.claude/skills/delete-comment/SKILL.md`) rejoue le tri sur un chemin.

## Conséquences

- Un « pourquoi » se cherche dans `doc/adr/`, pas dans le code.
- `e2e/` et `expo/` n'ont pas d'ESLint : la règle y est suivie par convention, sans vérification automatique.
- Le schéma Prisma et les migrations SQL gardent leurs commentaires (hors périmètre).
