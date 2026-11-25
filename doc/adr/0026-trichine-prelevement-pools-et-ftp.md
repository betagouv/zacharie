# 0026. Trichine : prélèvement, pools et FTP (émetteur)

## Contexte

En circuit agréé, le SVI prélève des échantillons sur les sangliers, les regroupe en pools selon le règlement UE 2015/1375 (§9 de [trichine.md](../trichine.md)), et les envoie au LVD avec une FTP papier dans le colis.

## Décision

**Périmètre** : le SVI prélève sur les carcasses assignées à son service et sur celles déjà arrivées chez un ETG rattaché, pas encore transmises (`carcassesAccessiblesAuSvi`, `carcassesAVenirChezEtgWhere`), car il prélève à l'arrivage (réception = prise en charge par l'ETG). Seul le SVI assigné prélève. Une carcasse retirée de sa fiche (`trichine_retire_de_fei_at`) n'est plus réclamée.

**Prélèvement** :

- En lot, tout ou rien (`/echantillons`) : un refus sur une carcasse refuse le lot. Type commun au lot : INITIAL, ou COMPLEMENTAIRE en 2e intention ; CONFIRMATION est réservé au LNR.
- Un prélèvement n'a de sens que pour ouvrir une analyse (`validateNouveauPrelevement`, `etatDesAnalyses`, §5.1). Prélevabilité côté app (`src/utils/trichine-prelevabilite.ts`) : `LIBRE`, `INITIAL_A_REFAIRE` (analyse impossible = inexistante), `DEUXIEME_INTENTION` (dans un pool douteux qu'aucune fille ne couvre ; le plus récent), `BLOQUEE`. Un échantillon retiré par le laboratoire n'a jamais été analysé : la carcasse est à re-prélever.

**Pools** (`validatePoolComposition`, `src/utils/trichine-repartition.ts`) :

- Initial : au plus 19 carcasses (`TRICHINE_POOL_INITIAL_MAX_CARCASSES`) et 100 g. Fille : au plus 5 carcasses du pool mère. Petite-fille : une seule carcasse, 50 g minimum. Masses par défaut 5 g / 20 g / 50 g selon le rang. Profondeur limitée là. Limites comptées par carcasse, un échantillon par carcasse dans un pool.
- Le rang du pool et celui des échantillons vont de pair ; un complémentaire ne se regroupe qu'en 2e intention, après un résultat douteux du parent. Lot de départ en 2e intention : les carcasses du pool douteux qu'aucune fille ne couvre.
- Répartition automatique : ordre d'entrée conservé, groupes (ex. premier détenteur) jamais mélangés, groupe trop gros scindé. Déplacer une carcasse à la main passe en `MANUEL` ; `PLUS_TARD` crée les échantillons sans pool. Le glisser-déposer ne marche ni au doigt ni au clavier : la liste déroulante reste le chemin garanti.
- Un pool est figé dès que sa FTP est partie. Un pool vide n'existe pas : retirer le dernier échantillon exige de supprimer le pool. Supprimer un pool mère exige de supprimer d'abord ses filles. Un échantillon retiré par le laboratoire reste tel que reçu et ne se regroupe plus.

**FTP** :

- Part au nom du service d'inspection (expéditeur imprimé, entité facturée). Créée en brouillon puis envoyée depuis son détail. L'annuaire ne liste que les LVD (le LNR ne reçoit que des FTP de confirmation automatiques).
- À l'envoi : pools, échantillons et carcasses passent « en cours d'analyses », la FTP en `EN_COURS_ANALYSES` avec historique ; le PDF est archivé et joint à la notification (voir [0028](0028-trichine-documents-pdf-et-stockage.md)).
- Une FTP supprimée ou annulée libère ses pools. Annulation possible tant que le laboratoire n'a pas réceptionné : statut ANNULEE + motif, laboratoire prévenu. Un pool engagé dans une autre FTP vivante ne peut pas être ajouté.
- Les listes de pools et d'échantillons libres sont rechargées à chaque ouverture.

**UI** (`routes/trichine/*`, `components/trichine/*`) : espace avec sa propre navigation ; l'accueil met en avant ce qui demande une action. Gabarit de détail commun : identité et actions, chaîne carcasse → échantillon → pool → FTP → laboratoire, contenu et chronologie. Recherche par référence en combobox (seulement des références existantes). L'assistant (`wizard-ui`) est volontairement hors DSFR (écran dense). Les références de pool sont mises en avant et copiables.

## Conséquences

- Les contraintes de pool sont validées côté backend et rappelées côté UI : modifier l'une sans l'autre crée des refus incompréhensibles.
