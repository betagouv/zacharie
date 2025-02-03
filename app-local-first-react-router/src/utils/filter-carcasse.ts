import { CarcasseStatus, CarcasseType } from '@prisma/client';
import grandGibier from '@app/data/grand-gibier.json';
import petitGibier from '@app/data/petit-gibier.json';
import { Filter, FilterableField } from '@app/types/filter';
import { CarcasseForResponseForRegistry } from '@api/src/types/carcasse';
import dayjs from 'dayjs';

const carcasseStatusOptions = [
  'Manquant(e)',
  'En traitement assainissant',
  'Saisie totale',
  'Saisie partielle',
  'Levée de consigne',
  'Consigné(e)',
  'Accepté(e)',
  'Sans décision',
];

export function mapCarcasseStatusLabelToValue(label: (typeof carcasseStatusOptions)[number]): string {
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
      return CarcasseStatus.SANS_DECISION;
    default: {
      return label;
    }
  }
}

const carcasseTypeOptions = [
  'Grand gibier', // Gros gibier
  'Petit gibier',
];

export function mapCarcasseTypeLabelToValue(label: (typeof carcasseTypeOptions)[number]): string {
  switch (label) {
    case 'Grand gibier':
      return CarcasseType.GROS_GIBIER;
    case 'Petit gibier':
      return CarcasseType.PETIT_GIBIER;
    default: {
      return label;
    }
  }
}

type CarcasseFilterableField = FilterableField & {
  name: keyof CarcasseForResponseForRegistry;
};

export const carcasseFilterableFields: Array<CarcasseFilterableField> = [
  { name: 'numero_bracelet', label: 'Numéro de bracelet', type: 'text' },
  { name: 'fei_numero', label: 'Numéro FEI', type: 'text' },
  { name: 'type', label: 'Petit ou gros gibier', type: 'enum', options: carcasseTypeOptions },
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
  { name: 'svi_carcasse_archived', label: 'Archivé(e)', type: 'boolean' },
  { name: 'svi_carcasse_signed_at', label: 'Date de signature', type: 'date-with-time' },
  { name: 'svi_carcasse_commentaire', label: 'Commentaire', type: 'text' },
  { name: 'svi_carcasse_status', label: 'Statut', type: 'enum', options: carcasseStatusOptions },
  { name: 'svi_carcasse_status_set_at', label: 'Date de décision', type: 'date-with-time' },
  { name: 'created_at', label: 'Date de création de la carcasse', type: 'date-with-time' },
  { name: 'updated_at', label: 'Date de mise à jour de la carcasse', type: 'date-with-time' },
  // { name: 'zacharie_carcasse_id', label: 'ID Zacharie', type: 'text' },
  { name: 'fei_date_mise_a_mort', label: 'Date de mise à mort', type: 'date-with-time' },
  { name: 'fei_commune_mise_a_mort', label: 'Commune de mise à mort', type: 'text' },
  {
    name: 'fei_heure_mise_a_mort_premiere_carcasse',
    label: 'Heure de mise à mort de la première carcasse de la fiche',
    type: 'date-with-time',
  },
  {
    name: 'fei_heure_evisceration_derniere_carcasse',
    label: "Heure d'éviscération de la dernière carcasse de la fiche",
    type: 'date-with-time',
  },
  // {
  //   name: 'fei_resume_nombre_de_carcasses',
  //   label: 'Nombre de carcasses ou de lots de la fiche',
  //   type: 'number',
  // },
  {
    name: 'fei_examinateur_initial_date_approbation_mise_sur_le_marche',
    label: "Date d'approbation de la mise sur le marché",
    type: 'date-with-time',
  },
  { name: 'fei_premier_detenteur_name_cache', label: 'Nom du premier détenteur', type: 'text' },
  {
    name: 'fei_premier_detenteur_date_depot_quelque_part',
    label: 'Date de dépot des carcasses de la fiche',
    type: 'date-with-time',
  },
  { name: 'fei_svi_assigned_at', label: 'Date de transmission au SVI', type: 'date-with-time' },
  // { name: 'fei_svi_carcasses_saisies', label: 'Nombre de carcasses saisies', type: 'number' },
  // { name: 'fei_svi_aucune_carcasse_saisie', label: 'Aucune carcasse saisie', type: 'boolean' },
  { name: 'fei_svi_commentaire', label: 'Commentaire', type: 'text' },
  { name: 'fei_svi_signed_at', label: 'Date de signature', type: 'date-with-time' },
  // { name: 'fei_svi_signed_by', label: 'Signé par', type: 'text' },
  { name: 'fei_created_at', label: 'Date de création de la fiche', type: 'date-with-time' },
  { name: 'fei_updated_at', label: 'Date de mise à jour de la fiche', type: 'date-with-time' },
  // { name: 'fei_deleted_at', label: 'Date de suppression de la fiche', type: 'date-with-time' },
  {
    name: 'fei_automatic_closed_at',
    label: 'Date de clôture automatique de la fiche',
    type: 'date-with-time',
  },
];

export type CarcasseFilter = Filter & {
  field: CarcasseFilterableField['name'];
};

export const filterCarcassesInRegistre =
  (filters: Array<CarcasseFilter>, debug = false) =>
  (item: CarcasseForResponseForRegistry) => {
    // for now an item needs to fulfill ALL items to be displayed
    if (!filters?.filter((f) => Boolean(f?.value)).length) return item;
    for (const filter of filters) {
      if (debug) console.log('filter', filter);
      if (!filter.field || !filter.value) continue;
      let itemValue = item[filter.field];

      if (filter.field === 'svi_carcasse_saisie') {
        itemValue = item.svi_carcasse_status;
        const itemIsSaisie =
          itemValue === CarcasseStatus.SAISIE_PARTIELLE || itemValue === CarcasseStatus.SAISIE_TOTALE;
        if (filter.value === 'Oui') {
          return itemIsSaisie;
        } else {
          return !itemIsSaisie;
        }
      }

      if (['number'].includes(filter.type)) {
        const itemNumber = Number(itemValue);
        const { number, number2, comparator } = filter.value;
        if (comparator === 'unfilled') {
          if (typeof itemNumber === 'number') return false;
          continue;
        }
        // be careful:
        // now we want to exclude everything that is not a number
        // BUT we can't use `isNaN` here because if itemValue is `null`, isNaN(null) === false, because `Number(null) === 0`
        if (typeof itemNumber !== 'number') return false;
        if (comparator === 'between') {
          if (Number(number) < Number(number2)) {
            if (Number(itemNumber) >= Number(number) && Number(itemNumber) <= Number(number2)) continue;
            return false;
          } else {
            if (Number(itemNumber) >= Number(number2) && Number(itemNumber) <= Number(number)) continue;
            return false;
          }
        }
        if (comparator === 'equals') {
          if (Number(itemNumber) === Number(number)) continue;
          return false;
        }
        if (comparator === 'lower') {
          if (Number(itemNumber) < Number(number)) continue;
          return false;
        }
        if (comparator === 'greater') {
          if (Number(itemNumber) > Number(number)) continue;
          return false;
        }
      }
      // now we know that itemValue is not a number
      if (typeof itemValue === 'number') {
        console.error('itemValue is a number', itemValue);
        return;
      }
      if (['boolean'].includes(filter.type)) {
        if (filter.value === 'Oui' && !!itemValue) continue;
        if (filter.value === 'Non' && !itemValue) continue;
        return false;
      }
      if (['date-with-time', 'date', 'duration'].includes(filter.type)) {
        const { date, comparator } = filter.value;
        if (comparator === 'unfilled') {
          if (!itemValue) continue;
          return false;
        }
        if (!itemValue) return false;
        if (typeof itemValue !== 'string') return false;
        if (comparator === 'before') {
          if (dayjs(itemValue).isBefore(date)) continue;
          return false;
        }
        if (comparator === 'after') {
          if (dayjs(itemValue).isAfter(date)) continue;
          return false;
        }
        if (comparator === 'equals') {
          if (dayjs(itemValue).isSame(dayjs(date), 'day')) continue;
          return false;
        }
      }
      if (itemValue instanceof Date) {
        console.error('itemValue is a date', itemValue);
        return;
      }
      if (typeof itemValue === 'boolean') {
        if (!itemValue) {
          if (filter.value === 'Non renseigné') continue;
          return false;
        }
        if (itemValue === (filter.value === 'Oui')) continue;
        return false;
      }

      const arrayFilterValue = Array.isArray(filter.value) ? filter.value : [filter.value];
      if (!arrayFilterValue.length) continue;
      // here the item needs to fulfill at least one filter value
      let isSelected = false;
      for (let filterValue of arrayFilterValue) {
        if (filter.field === 'svi_carcasse_status') {
          filterValue = mapCarcasseStatusLabelToValue(filterValue);
        }
        if (filter.field === 'type') {
          filterValue = mapCarcasseTypeLabelToValue(filterValue);
        }
        if (!itemValue?.length && filterValue === 'Non renseigné') {
          isSelected = true;
          break;
        }
        if (typeof itemValue === 'string') {
          // For type text we trim and lower case the value.
          if (filter.type === 'text') {
            const trimmedItemValue = (itemValue || '').trim().toLowerCase();
            const trimmedFilterValue = (filterValue || '').trim().toLowerCase();
            if (trimmedItemValue.includes(trimmedFilterValue)) {
              isSelected = true;
              break;
            }
          }
          if (itemValue === filterValue) {
            isSelected = true;
            break;
          }
        } else {
          if (itemValue?.includes?.(filterValue)) {
            isSelected = true;
          }
        }
      }
      if (!isSelected) return false;
    }
    return item;
  };
