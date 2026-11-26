# 0027. Trichine : laboratoires et résultats

## Contexte

Le LVD reçoit les colis et rend les résultats ; sur un résultat non négatif, le LNR confirme. Les laboratoires importent souvent leurs résultats depuis leur LIMS. Ils ne doivent voir que le strict nécessaire (§10.2 de [trichine.md](../trichine.md)).

## Décision

**Visibilité** (`api-express/src/controllers/laboratoire.ts`) :

- Projection serveur dédiée (carcasse minimale, émetteur réduit à nom et contact), sans réutiliser `/carcasse/:id`. Les échantillons ne sont lus que pour compter les carcasses en attente d'IPM2.
- Un pool est accessible s'il est rattaché à une FTP non brouillon destinée à un laboratoire de l'utilisateur ; on retient le lien le plus récent. Un LVD est aussi expéditeur de la FTP de confirmation, avec les mêmes droits. Le LNR ne voit la fiche d'origine que si elle lui appartient aussi.
- Le PDF de la FTP est le même document que celui imprimé par l'émetteur (le colis peut arriver sans papier). Détail lu par référence.
- Mêmes écrans pour LVD et LNR ; le backend filtre par entité destinataire. Une FTP émise par le labo se consulte sans se traiter. Classement côté labo par statut logistique (la réception), pas par présence d'un résultat. « Envoyée » = colis à réceptionner. BROUILLON n'atteint jamais le labo. Profil en lecture seule (coordonnées et COFRAC gérés par l'administration).

**Saisie** (`utils/trichine-result.ts`) :

- `validateResultForPool` et `applyPoolResult` sont la source unique, partagée par la saisie manuelle (`POST /laboratoire/pool/:id/resultat`) et l'import. `describePoolResultActions` décrit à l'aperçu ce que `applyPoolResult` fera : à tenir à jour ensemble.
- Résultats selon le type de laboratoire (`LVD_RESULTS`). Parasite obligatoire sur NON_NEGATIF. Seul le LNR écrase un DOUTEUX ; tout autre résultat est définitif. Date d'analyse avec un jour de marge (AAAA-MM-JJ lue à minuit UTC).
- Référence labo : saisie à la main, une référence refusée bloque et un champ vidé la retire ; lue dans un import, elle est facultative, ignorée si refusée, ne retire jamais rien. Posée comme alias au nom du laboratoire destinataire.
- Nombre de larves non renseigné : on garde celui déjà posé. `nombre_larves_lvd` / `nombre_larves_lnr` séparés. Jamais envoyé à l'émetteur.
- Non négatif saisi par un LVD : le pool devient pool de confirmation et une FTP de confirmation vers le LNR est générée d'office, envoyée avec date d'envoi, modalités de transmission et conditions de conservation (saisie manuelle ; un import n'a pas ces colonnes). Elle part du LVD (son code dans la référence) en EN_COURS_ANALYSES ; le labo l'imprime et la joint au colis. « Analyse impossible » se choisit dans la même modale et passe par la route de refus.
- Dès qu'un pool part au LNR, son résultat appartient au LNR : le LVD ne refuse ni ne corrige plus.
- Notifications : un résultat n'est notifié qu'à l'émetteur de la FTP ; une confirmation LNR alerte le LVD (avec le nombre de larves) et l'émetteur initial.

**Retrait et correction** :

- Retrait d'un échantillon (absent, abîmé, mal identifié), à réception ou en analyse, tant que le résultat du pool peut être saisi : il sort du pool, n'hérite pas du résultat, sa carcasse repasse « à prélever ». Le dernier ne se retire pas (on refuse le pool). Retrait filtré sur `pool_id` (deux retraits simultanés n'en appliquent qu'un). On prévient l'émetteur (sur une confirmation, l'émetteur d'origine).
- Correction d'un résultat rendu (`/pool/:pool_id/corriger-resultat`) : interdite après l'IPM2 du SVI, sur un DOUTEUX, ou par un LVD sur un pool parti au LNR. Le pool est remis à zéro et passe par `applyPoolResult` ; si refus, le résultat d'origine est restitué. La référence labo est alors figée.

**Statuts** (`utils/trichine-status.ts`, §4.11) : `compute*` purs, `recompute*` persistent et alimentent `TrichineHistoriqueStatut` (audit réglementaire). DOUTEUX n'est pas terminal. Un pool mère n'est pas terminé tant qu'une fille est en cours. Une FTP reçue passe à TRAITEE quand tous ses résultats sont saisis, sans action du laboratoire. On recalcule toutes les FTP qui référencent un pool (FTP d'origine et de confirmation). Action requise sur la carcasse : null s'il n'y a rien à signaler ; plus d'action de prélèvement après un résultat final LNR ; à re-prélever si le dernier échantillon a été retiré.

**Import LIMS** (`utils/lims-parse.ts`, `classifyLimsRow`) : format unique imposé par Zacharie (documenté sur `/app/laboratoire/results/format`). CSV en base64, séparateur détecté sur l'en-tête (`;` prioritaire), valeurs normalisées (casse, accents). `non_negatif` se lit selon le laboratoire destinataire (LVD : larve à confirmer ; LNR : parasite autre). Référence Zacharie (`P-YY-…`) prioritaire sur l'alias ; un alias porté par deux pools est ambigu. Un pool ne reçoit qu'un résultat (première ligne importable). Pools lus une fois avant la boucle ; ids jamais repris du client ; pas de seconde tentative sur un pool en échec partiel.

## Conséquences

- Toute évolution des effets de `applyPoolResult` doit être reportée dans `describePoolResultActions`.
