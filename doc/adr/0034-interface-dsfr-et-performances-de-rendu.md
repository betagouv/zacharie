# 0034. Interface DSFR : contournements et performances de rendu

## Contexte

Le DSFR (`@codegouvfr/react-dsfr`) a des bugs de piège à focus et d'enregistrement des modales, et ne gère pas l'empilement des modales. Une fiche peut porter plusieurs centaines de carcasses, chacune avec ses modales.

## Décision

**Contournements DSFR** :

- Le piège à focus prend tout `<input>` sans `type` pour un radio et plante (« reading 'keep' ») si la page contient un radio. `Input.tsx` pose `type="text"`, comme l'assistant trichine ; `SelectCustom` ne transmet pas `required` à react-select (aucun select n'est dans un `<form>`).
- DSFR enregistre les `<dialog>` de façon asynchrone : `Modal.tsx` réessaie `open()` aux frames suivantes (« reading 'modal' », WebView Android lentes). Une modale retirée encore ouverte (bouton retour Android) est fermée au démontage (cleanup d'un layout effect), sinon le piège à focus plante à chaque modale suivante (e2e `173-retour-arriere-modale-ouverte`).
- Les modales ne s'empilent pas (verrou de scroll booléen, contenu du parent perdu) : on ferme l'une avant d'ouvrir l'autre, ou on déplie un accordéon.
- La liste de suggestions sous un champ reste montée même vide : sinon le champ devient `:last-child` et perd sa marge basse.
- Les `id` des champs des formulaires d'entité et d'adresse sont préfixés (plusieurs formulaires par page).
- Le bouton placé dans un `<label>` appelle `preventDefault` (sinon iOS donne le focus au champ). Liens en cellule de table : stopper la propagation, ne pas ajouter `underline`.
- Bouton principal de la modale d'ajout de carcasse dans le footer natif (`NouvelleCarcasse` expose sa soumission par ref).

**Performances** :

- `LazyModal` / `useLazyModal` : une modale par carte coûtait un `<dialog>` et un MutationObserver sur tout le document ; avec 300 carcasses, l'ajout d'une carcasse ralentissait. `LazyModal` n'est rendu que si `isMounted` et s'ouvre à son montage, déclaré après `useIsModalOpen`.
- `CardCarcasse` ne dépend que de la date de la fiche, pas de son `updated_at`. Cartes mémoïsées ; les objets non modifiés gardent leur référence dans le store.
- Index carcasse → intermédiaires (`get-carcasses-intermediaires.ts`) construit une fois par version du store (300 cartes × 20 000 intermédiaires ≈ 1 s sinon). Le tableau renvoyé est partagé : ne pas le modifier.
- `useCarcassesRegistry` dérive la liste des carcasses non supprimées de `state.carcasses`.
- `ConnexionButton` n'est pas dans un `<form>` (mille formulaires font ramer l'autofill).
- `TableFilterable` : la case d'en-tête n'agit que sur les lignes visibles.

**Choix d'affichage** : `CardCarcasseSvi` une ligne par information, consigne mise en évidence. `DonneesDeChasse` affiche un prochain détenteur désigné en dernière étape de la frise. Date d'inspection SVI sans heure placée après les prises en charge du même jour. Une entité absente du store n'empêche pas d'afficher le registre (repli sur le nom de l'utilisateur puis l'id).

## Conséquences

- Toute nouvelle modale dans une liste passe par `LazyModal`.
- Tout nouvel `<input>` dans une page à modale doit avoir un `type`.
