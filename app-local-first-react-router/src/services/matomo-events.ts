export const MATOMO_EVENTS = {
  fiche: {
    creer: [
      'bouton-flottant',
      'barre-navigation',
      'liste-mobile',
      'liste-bureau',
      'liste-vide',
      'tableau-de-bord-vide',
      'apres-envoi',
      'lien-direct',
    ],
    'designer-premier-detenteur': ['moi', 'association', 'autre-utilisateur'],
    'confirmer-examen': ['avec-anomalie', 'sans-anomalie'],
    'valider-examen': ['avec-anomalie', 'sans-anomalie'],
    transmettre: ['premier-detenteur', 'destinataire'],
    bloquer: [
      'date-mise-a-mort',
      'commune',
      'premier-detenteur',
      'heure-prelevement',
      'heure-evisceration',
      'aucune-carcasse',
      'carcasse-incomplete',
      'date-validation-examen',
      'date-validation-avant-mise-a-mort',
      'certification',
      'vente-don',
      'lien-invalide',
    ],
    supprimer: [],
    quitter: [],
  },
  carcasse: {
    ajouter: ['grand-gibier', 'petit-gibier'],
    supprimer: [],
    bloquer: ['numero-bracelet-manquant', 'espece-manquante', 'numero-bracelet-deja-utilise'],
    'modifier-anomalie': ['ajout', 'retrait'],
  },
  anomalie: {
    'ouvrir-selecteur': ['grand-gibier', 'petit-gibier'],
    selectionner: ['liste', 'recherche'],
    retirer: ['liste', 'recherche', 'pastille', 'saisie-libre'],
    rechercher: ['resultat-trouve', 'resultat-vide'],
    'saisir-libre': ['famille', 'hors-famille', 'recherche-vide'],
    'agrandir-photo': [],
  },
  'vente-don': {
    enregistrer: ['usage-domestique', 'destinataire'],
    supprimer: [],
    bloquer: ['destinataire', 'carcasses', 'stockage', 'transport'],
  },
  ccg: {
    creer: ['numero-existant', 'nouvelle'],
  },
  partenaire: {
    creer: [],
  },
  laboratoire: {
    exporter: ['pools-csv', 'pools-json', 'echantillons-csv', 'echantillons-json', 'ftps-csv', 'ftps-json'],
  },
} as const satisfies Record<string, Record<string, readonly string[]>>;

export type MatomoEvents = typeof MATOMO_EVENTS;
export type MatomoCategory = keyof MatomoEvents;
export type MatomoAction<C extends MatomoCategory> = keyof MatomoEvents[C] & string;
export type MatomoName<
  C extends MatomoCategory,
  A extends MatomoAction<C>,
> = MatomoEvents[C][A] extends readonly (infer N)[] ? N : never;
