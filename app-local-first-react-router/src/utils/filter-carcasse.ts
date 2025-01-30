import { CarcasseStatus, CarcasseType } from '@prisma/client';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import { FilterableField } from '@app/types/filter';

export function mapCarcasseStatusLabelToValue(label: (typeof CarcasseStatusOptions)[number]) {
  switch (label) {
    case 'Manquante':
      return CarcasseStatus.MANQUANTE;
    case 'En traitement assainissant':
      return CarcasseStatus.TRAITEMENT_ASSAINISSANT;
    case 'Saisie totale':
      return CarcasseStatus.SAISIE_TOTALE;
    case 'Saisie partielle':
      return CarcasseStatus.SAISIE_PARTIELLE;
    case 'Levée de consigne':
      return CarcasseStatus.LEVEE_DE_CONSIGNE;
    case 'Consigné(e)':
      return CarcasseStatus.CONSIGNE;
    case 'Accepté(e)':
      return CarcasseStatus.ACCEPTE;
    case 'Sans décision':
    default:
      return CarcasseStatus.SANS_DECISION;
  }
}

export const carcasseFilterableFields: FilterableField[] = [
  { name: 'numero_bracelet', label: 'Numéro de bracelet', type: 'text' },
  { name: 'fei_numero', label: 'Numéro FEI', type: 'text' },
  { name: 'type', label: 'Petit ou gros gibier', type: 'enum', options: Object.values(CarcasseType) },
  { name: 'nombre_d_animaux', label: "Nombre d'animaux", type: 'number' },
  { name: 'heure_mise_a_mort', label: 'Heure de mise à mort', type: 'date-with-time' },
  { name: 'heure_evisceration', label: "Heure d'éviscération", type: 'date-with-time' },
  {
    name: 'espece',
    label: 'Espèce',
    type: 'enum',
    options: [...grandGibier.especes, ...petitGibier.especes],
  },
  // { name: 'categorie', label: 'Catégorie', type: 'enum', options: ['open', 'closed'] },
  // { name: 'examinateur_carcasse_sans_anomalie', label: 'Examinateur sans anomalie', type: 'boolean' },
  // { name: 'examinateur_anomalies_carcasse', label: 'Anomalies carcasse', type: 'multi-choice', options: ['open', 'closed'] },
  // { name: 'examinateur_anomalies_abats', label: 'Anomalies abats', type: 'multi-choice', options: ['open', 'closed'] },
  // { name: 'examinateur_commentaire', label: 'Commentaire examinateur', type: 'text' },
  // { name: 'examinateur_signed_at', label: 'Date de signature examinateur', type: 'date-with-time' },
  // { name: 'intermediaire_carcasse_refus_intermediaire_id', label: 'ID intermédiaire refus', type: 'text' },
  { name: 'intermediaire_carcasse_refus_motif', label: 'Motif refus intermédiaire', type: 'text' },
  {
    name: 'intermediaire_carcasse_signed_at',
    label: 'Date de signature intermédiaire',
    type: 'date-with-time',
  },
  // { name: 'intermediaire_carcasse_commentaire', label: 'Commentaire intermédiaire', type: 'text' },
  // { name: 'intermediaire_carcasse_manquante', label: 'Manquante', type: 'boolean' },
  { name: 'svi_assigned_to_fei_at', label: 'Date de transmission au SVI', type: 'date-with-time' },
  { name: 'svi_carcasse_manquante', label: 'Manquante', type: 'boolean' },
  { name: 'svi_carcasse_consigne', label: 'Consigné', type: 'boolean' },
  { name: 'svi_carcasse_consigne_at', label: 'Date de signature consigne', type: 'date-with-time' },
  { name: 'svi_carcasse_consigne_motif', label: 'Motif consigne', type: 'text' },
  { name: 'svi_carcasse_consigne_levee', label: 'Levée de consigne', type: 'boolean' },
  { name: 'svi_carcasse_consigne_levee_at', label: 'Date de levée de consigne', type: 'date-with-time' },
  { name: 'svi_carcasse_saisie', label: 'Saisie', type: 'boolean' },
  { name: 'svi_carcasse_saisie_at', label: 'Date de saisie', type: 'date-with-time' },
  { name: 'svi_carcasse_saisie_motif', label: 'Motif saisie', type: 'text' },
  { name: 'svi_carcasse_traitement_assainissant', label: 'Traitement assainissant', type: 'boolean' },
  { name: 'svi_carcasse_signed_at', label: 'Date de signature', type: 'date-with-time' },
  { name: 'svi_carcasse_commentaire', label: 'Commentaire', type: 'text' },
  { name: 'svi_carcasse_status', label: 'Statut', type: 'enum', options: Object.values(CarcasseStatus) },
  { name: 'svi_carcasse_status_set_at', label: 'Date de décision', type: 'date-with-time' },
  { name: 'created_at', label: 'Date de création', type: 'date-with-time' },
  { name: 'updated_at', label: 'Date de mise à jour', type: 'date-with-time' },
  // { name: 'zacharie_carcasse_id', label: 'ID Zacharie', type: 'text' },
];
