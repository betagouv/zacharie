import { Link } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';

// Format unique du fichier d'import de résultats, lu par api-express/src/utils/lims-parse.ts
const colonnes: Array<[string, string, string, string]> = [
  [
    'reference_pool',
    'Oui',
    'Référence Zacharie du pool, ou votre référence interne du pool',
    'P-26-EG01-0001',
  ],
  ['resultat_analyse', 'Oui', 'Résultat de l’analyse (valeurs ci-dessous)', 'negatif'],
  ['parasite_identifie', 'LNR, si non_negatif', 'Nom du parasite identifié', 'Sarcocystis'],
  [
    'nombre_larves',
    'Non',
    'Nombre de larves découvertes dans le pool, sur un résultat autre que negatif. Visible uniquement par les laboratoires',
    '2',
  ],
  ['date_debut_analyse', 'Non', 'Date de début de l’analyse, au format AAAA-MM-JJ', '2026-10-20'],
  [
    'date_fin_analyse',
    'Non',
    'Date de fin de l’analyse, au format AAAA-MM-JJ (par défaut : jour de l’import)',
    '2026-10-21',
  ],
  ['reference_labo', 'Non', 'Votre référence interne du pool, enregistrée dans Zacharie', 'LAB-2026-001'],
  ['commentaire', 'Non', 'Commentaire libre', ''],
];

const valeurs: Array<[string, string, string]> = [
  ['negatif', 'LVD', 'Pas de larve : les carcasses du pool sont libérées'],
  ['non_negatif', 'LVD', 'Larve détectée : le pool part automatiquement au LNR pour confirmation'],
  ['positif', 'LNR', 'Trichine confirmée'],
  ['non_negatif', 'LNR', 'Parasite autre que la trichine (remplir parasite_identifie)'],
  ['presence_parasite_non_identifie', 'LNR', 'Parasite présent mais non identifié'],
];

export default function LaboratoireResultsFormat() {
  return (
    <div className="py-4">
      <title>Format du fichier d'import | Laboratoire | Zacharie</title>
      <Link
        to="/app/laboratoire/results/import"
        className="fr-link fr-icon-arrow-left-line fr-link--icon-left mb-4"
      >
        Retour à l'import
      </Link>
      <h1 className="fr-h3">Format du fichier d'import de résultats</h1>
      <p>
        Zacharie lit un seul format de fichier, le même pour tous les laboratoires. C'est à votre LIMS (ou à
        votre tableur) de produire un fichier qui le respecte.
      </p>
      <p>
        <a
          href="/modele-import-resultats-trichine.csv"
          download
        >
          Télécharger le modèle (CSV)
        </a>
      </p>

      <h2 className="fr-h5">Le fichier</h2>
      <ul>
        <li>
          Fichier <code>.csv</code>, encodé en UTF-8.
        </li>
        <li>
          Séparateur point-virgule <code>;</code> (la virgule <code>,</code> est aussi acceptée).
        </li>
        <li>Première ligne : le nom des colonnes, exactement comme ci-dessous. L'ordre est libre.</li>
        <li>Une ligne par pool. Les colonnes qui ne sont pas dans la liste sont ignorées.</li>
      </ul>

      <h2 className="fr-h5">Les colonnes</h2>
      <div className="mb-6 overflow-x-auto">
        <Table
          noCaption
          headers={['Colonne', 'Obligatoire', 'Contenu', 'Exemple']}
          data={colonnes.map(([nom, obligatoire, contenu, exemple]) => [
            <code key="nom">{nom}</code>,
            obligatoire,
            contenu,
            exemple,
          ])}
        />
      </div>

      <h2 className="fr-h5">Valeurs de la colonne resultat_analyse</h2>
      <p>
        Les valeurs dépendent de votre laboratoire : <code>non_negatif</code> n’a pas le même sens pour un LVD
        et pour le LNR. Les majuscules et les accents sont ignorés : « Négatif », « NEGATIF » et « negatif »
        sont acceptés.
      </p>
      <div className="mb-6 overflow-x-auto">
        <Table
          noCaption
          headers={['Valeur', 'Laboratoire', 'Signification']}
          data={valeurs.map(([valeur, laboratoire, signification]) => [
            <code key="valeur">{valeur}</code>,
            laboratoire,
            signification,
          ])}
        />
      </div>

      <h2 className="fr-h5">Lignes qui ne sont pas importées</h2>
      <ul>
        <li>Le pool est introuvable, ou n'a pas été transmis à votre laboratoire.</li>
        <li>La valeur de résultat n'est pas dans la liste, ou n'est pas permise à votre laboratoire.</li>
        <li>Une date n'est pas au format AAAA-MM-JJ.</li>
        <li>
          Le nombre de larves n'est pas un nombre entier supérieur à 0, ou il est indiqué sur un résultat{' '}
          <code>negatif</code>.
        </li>
        <li>
          Le pool a déjà un résultat. Seul le LNR peut remplacer un résultat <code>non_negatif</code> d’un LVD
          par sa confirmation.
        </li>
      </ul>
      <p>
        Une référence interne refusée (déjà utilisée pour un autre pool) n'empêche pas l'import du résultat :
        elle est ignorée et l'aperçu vous le signale.
      </p>

      <h2 className="fr-h5">Exemple</h2>
      <pre className="overflow-x-auto bg-[var(--background-alt-grey)] p-4 text-sm">
        {`reference_pool;resultat_analyse;parasite_identifie;nombre_larves;date_debut_analyse;date_fin_analyse;reference_labo;commentaire
P-26-EG01-0001;negatif;;;2026-10-20;2026-10-21;LAB-2026-001;
P-26-EG01-0002;non_negatif;;2;2026-10-20;2026-10-21;LAB-2026-002;Larve observée`}
      </pre>
    </div>
  );
}
