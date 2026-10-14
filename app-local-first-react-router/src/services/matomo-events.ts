// Catalogue des événements métier envoyés à Matomo : catégorie → action → noms autorisés.
// Règles de nommage et d'évolution : doc/matomo.md.
// - catégorie = objet métier, au singulier, kebab-case
// - action = verbe à l'infinitif, kebab-case
// - nom = contexte pris dans une liste fermée, jamais une saisie ni une donnée personnelle
// - on ne renomme jamais un événement : on en ajoute un nouveau et on retire l'ancien du code
export const MATOMO_EVENTS = {
  fiche: {
    // name = bouton ou page d'où la fiche est créée
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
    // name = présence d'anomalies sur au moins une carcasse
    'confirmer-examen': ['avec-anomalie', 'sans-anomalie'],
    'valider-examen': ['avec-anomalie', 'sans-anomalie'],
    // value = nombre de carcasses transmises
    transmettre: ['premier-detenteur', 'destinataire'],
    // name = premier motif de blocage rencontré
    bloquer: [
      'date-mise-a-mort',
      'commune',
      'premier-detenteur',
      'heure-prelevement',
      'heure-evisceration',
      'aucune-carcasse',
      'carcasse-incomplete',
      'date-validation-examen',
      'certification',
      'vente-don',
      'lien-invalide',
    ],
    supprimer: [],
    // quitte la fiche en cours de saisie via le bouton « Retour »
    quitter: [],
  },
  carcasse: {
    // value = nombre d'anomalies saisies
    ajouter: ['grand-gibier', 'petit-gibier'],
    supprimer: [],
    bloquer: ['numero-bracelet-manquant', 'espece-manquante', 'numero-bracelet-deja-utilise'],
    'modifier-anomalie': ['ajout', 'retrait'],
  },
  // sélecteur d'anomalies (ajout ou modification d'une carcasse)
  anomalie: {
    'ouvrir-selecteur': ['grand-gibier', 'petit-gibier'],
    // name = d'où l'anomalie est cochée ou retirée
    selectionner: ['liste', 'recherche'],
    retirer: ['liste', 'recherche', 'pastille', 'saisie-libre'],
    // envoyé une fois la frappe terminée ; le texte recherché n'est jamais envoyé
    rechercher: ['resultat-trouve', 'resultat-vide'],
    // anomalie hors référentiel ; le texte saisi n'est jamais envoyé
    'saisir-libre': ['famille', 'hors-famille', 'recherche-vide'],
    'agrandir-photo': [],
  },
  'vente-don': {
    enregistrer: ['usage-domestique', 'destinataire'],
    supprimer: [],
    // name = étape de la modale où l'utilisateur est bloqué
    bloquer: ['destinataire', 'carcasses', 'stockage', 'transport'],
  },
  ccg: {
    // numero-existant = CCG déjà enregistrée, retrouvée par son numéro ; nouvelle = pré-enregistrement complet
    creer: ['numero-existant', 'nouvelle'],
  },
  partenaire: {
    creer: [],
  },
} as const satisfies Record<string, Record<string, readonly string[]>>;

export type MatomoEvents = typeof MATOMO_EVENTS;
export type MatomoCategory = keyof MatomoEvents;
export type MatomoAction<C extends MatomoCategory> = keyof MatomoEvents[C] & string;
export type MatomoName<
  C extends MatomoCategory,
  A extends MatomoAction<C>,
> = MatomoEvents[C][A] extends readonly (infer N)[] ? N : never;
