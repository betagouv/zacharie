# 0038. Assistant de résolution de bug (Albert)

## Contexte

L'admin dispose d'un assistant qui enquête sur un bug signalé, en lisant le code sur GitHub et la base en lecture seule. Il s'appuie sur Albert, l'API IA de la DINUM, compatible OpenAI. Le fonctionnement et la sécurité sont dans [bug-resolution.md](../bug-resolution.md).

## Décision

- Client Albert (`api-express/src/third-parties/albert.ts`) : réponse en streaming ; abandon après 2 min sans rien recevoir (`IDLE_TIMEOUT_MS`), 10 min au plus par appel. Réflexion dans `reasoning_content` ou `reasoning` selon vLLM. Texte et appels d'outils réassemblés. `tool_choice` vaut `"none"` par défaut chez Albert : il faut `"auto"` explicite. 429 / 5xx : réessai à délai croissant ; coupure réseau ou délai : un seul nouvel essai.
- Deux modèles : enquête (raisonnement + outils, texte seul) et vision, qui décrit une fois chaque nouvelle capture ; la description est gardée dans le message (`image_descriptions`).
- `service/bug-investigator/index.ts` : résultats d'outils des tours précédents raccourcis, seulement pour les tours terminés par une réponse. Contrôle du premier rapport : le premier jet (`draft`) est renvoyé avec une liste de vérifications (`control`) ; s'il n'a lu aucun fichier de code, une seconde fois. Sauvegardes du streaming une à la fois, terminées avant d'enregistrer l'étape.
- Outils en lecture seule (`tools.ts`). `checkReadOnlySql` : une seule instruction `SELECT` ou `WITH`, enveloppée dans une sous-requête qui impose la limite (Postgres y refuse les CTE qui écrivent). La vraie garantie est le rôle PostgreSQL SELECT-only. Résultat tronqué : avertissement en tête. Chronologie trop longue : on retire les entrées les plus anciennes. Le rôle d'un log est celui avec lequel l'utilisateur a agi ; on donne aussi son vrai compte.
- L'enquête tourne dans le process de l'API : au démarrage, les enquêtes « en cours » sont marquées interrompues (`markInterruptedInvestigations`).
- Front (`routes/admin/bug-resolution.tsx`) : captures réduites avant envoi (corps limité à 5 Mo) ; messages successifs d'Albert regroupés ; contrôle et premier jet visibles mais repliés.

## Conséquences

- Ne jamais ajouter d'outil qui écrit : la garantie côté base doit rester le rôle en lecture seule.
