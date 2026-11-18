# Test de charge

Mesure l'app d'un ETG avec un gros historique de carcasses. Hors de la suite e2e : il ne tourne pas en CI.

## Lancer

Base de test `zacharietest` et API de test sur le port 3291 (comme pour les e2e) :

```bash
cd e2e
CARCASSES=100000 npx tsx load/populate-volume.ts
CARCASSES=100000 npx playwright test -c load/playwright.load.config.ts
```

- `populate-volume.ts` part du seed `SVI_CLOSED` (une fiche clôturée de 4 carcasses passée par ETG 1) et la duplique en SQL, dates étalées sur 3 ans. 1 000 000 de carcasses : environ 5 minutes.
- `etg-volume.spec.ts` se connecte en `etg-1@example.fr` et mesure chaque étape : durée, temps où le thread principal est bloqué, plus longue tâche, mémoire JS. Utiliser le même `CARCASSES` que pour le remplissage.
- Le prochain `resetDb` d'un test e2e efface les données.

## Résultats de référence (novembre 2026, Mac, app en mode dev)

ETG seul sur 100 000 carcasses, avant la pagination par curseur :

| Étape                               | Durée  | Bloqué | Mémoire JS |
| ----------------------------------- | ------ | ------ | ---------- |
| Premier chargement                  | 26 s   | 2,9 s  | 370 Mo     |
| Écriture IndexedDB après chargement | ~2 min | –      | –          |
| Onglet Carcasses                    | 5,5 s  | 4,5 s  | 643 Mo     |
| Retour onglet Fiches                | 2,7 s  | 1,7 s  | 801 Mo     |

À 1 000 000 de carcasses pour un seul ETG, le premier chargement n'aboutissait pas en 2 heures : chaque page du pull
`GET /carcasse` comptait et triait tout le périmètre (`count()`, `OFFSET`, tri complet), environ 20 s par page.
La pagination par curseur avec l'index `Carcasse(updated_at desc, zacharie_carcasse_id desc)` ramène une page à
environ 0,1 s, quelle que soit sa position.

Le périmètre d'accès est un OR sur plusieurs colonnes, qu'aucun index ne sert. Il est lu en une requête par branche,
chacune servie par son index `(colonne, updated_at desc)` et limitée à une page, fusionnées par un `UNION`
(`getCarcasseScopeBranches` + `findScopeCarcassesPage`), pour tous les rôles. La branche `CarcasseIntermediaire`
lit l'index `(intermediaire_entity_id, carcasse_updated_at desc, zacharie_carcasse_id desc)` :
`carcasse_updated_at` est une copie de `Carcasse.updated_at`, posée par trigger. Pour les ETG, collecteurs et circuits
courts (`CarcasseIntermediaire` OU `next_owner` OU `current_owner`), mesuré sur 1 000 000 de carcasses : une petite ETG passe de 0,6 s à 0,1 s
pour la première page et de 0,8 s à 15 ms pour les suivantes ; la grosse ETG de 1,1 s à 0,3 s par page suivante.
