import { Link } from 'react-router';
import type { Carcasse } from '@prisma/client';
import { getCarcasseStatusLabel } from '@app/utils/get-carcasse-status';
import { isCarcasseSviArchived } from '@app/utils/carcasse-svi-archived';

export type CatalogColumn = {
  key: string;
  label: string;
  alwaysVisible?: boolean;
  dataKey: keyof Carcasse | string;
  title: string;
  type?: 'date' | 'datetime' | 'number' | 'string';
  sortable?: boolean;
  small?: boolean;
  render?: (item: Carcasse, index: number) => React.ReactNode;
};

export const DEFAULT_VISIBLE_COLUMN_KEYS = [
  'numero_bracelet',
  'fei_premier_detenteur_name_cache',
  'fei_svi_assigned_at',
  'svi_carcasse_status',
  'svi_carcasse_archived',
  'svi_carcasse_status_set_at',
  'fei_numero',
  'collecteur',
];

export const itemsPerPageOptions = [20, 50, 100, 200, 1000];

interface GetColumnsArgs {
  page: number;
  itemsPerPage: number;
  getCollecteurName: (carcasse: Carcasse) => string | null;
}

// Catalogue de colonnes partagé entre la liste des carcasses ETG et le détail utilisateur.
export function getEtgCarcasseColumns({
  page,
  itemsPerPage,
  getCollecteurName,
}: GetColumnsArgs): Array<CatalogColumn> {
  return [
    {
      key: 'row_index',
      label: 'Numéro de ligne',
      alwaysVisible: true,
      dataKey: 'zacharie_carcasse_id',
      title: '',
      small: true,
      render: (_carcasse, index) => <>{(page - 1) * itemsPerPage + index + 1}</>,
    },
    {
      key: 'numero_bracelet',
      label: 'Identification (marquage + espèce)',
      alwaysVisible: true,
      dataKey: 'numero_bracelet',
      title: 'Identification',
      sortable: true,
      render: (carcasse) => (
        <div className="flex flex-col items-start">
          <Link
            to={`/app/etg/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`}
            className="mr-auto block"
          >
            {carcasse.numero_bracelet}
          </Link>
          <small className="text-xs text-gray-400">{carcasse.espece}</small>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Catégorie de gibier',
      dataKey: 'type',
      title: 'Catégorie',
      sortable: true,
      render: (carcasse) => (carcasse.type === 'GROS_GIBIER' ? 'Grand gibier' : 'Petit gibier'),
    },
    {
      key: 'nombre_d_animaux',
      label: 'Nombre d’animaux',
      dataKey: 'nombre_d_animaux',
      title: 'Nb animaux',
      type: 'number',
      sortable: true,
    },
    {
      key: 'date_mise_a_mort',
      label: 'Date de mise à mort',
      dataKey: 'date_mise_a_mort',
      title: 'Date mise à mort',
      type: 'date',
      sortable: true,
    },
    {
      key: 'commune_mise_a_mort',
      label: 'Commune de mise à mort',
      dataKey: 'commune_mise_a_mort',
      title: 'Commune',
      sortable: true,
    },
    {
      key: 'heure_mise_a_mort',
      label: 'Heure de mise à mort',
      dataKey: 'heure_mise_a_mort',
      title: 'Heure mise à mort',
    },
    {
      key: 'heure_evisceration',
      label: 'Heure d’éviscération',
      dataKey: 'heure_evisceration',
      title: 'Heure éviscération',
    },
    {
      key: 'premier_detenteur_name_cache',
      label: 'Premier détenteur',
      dataKey: 'premier_detenteur_name_cache',
      title: 'Premier détenteur',
      sortable: true,
    },
    {
      key: 'premier_detenteur_depot_entity_name_cache',
      label: 'Centre de collecte (CCG)',
      dataKey: 'premier_detenteur_depot_entity_name_cache',
      title: 'CCG',
      sortable: true,
    },
    {
      key: 'collecteur',
      label: 'Collecteur',
      dataKey: 'collecteur',
      title: 'Collecteur',
      render: (carcasse) => getCollecteurName(carcasse) || '-',
    },
    {
      key: 'examinateur_initial_date_approbation_mise_sur_le_marche',
      label: 'Date d’approbation de la mise sur le marché',
      dataKey: 'examinateur_initial_date_approbation_mise_sur_le_marche',
      title: 'Date approbation marché',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'svi_assigned_at',
      label: 'Date de transmission au SVI',
      dataKey: 'svi_assigned_at',
      title: 'Date transmission SVI',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'latest_intermediaire_signed_at',
      label: 'Date dernière décision destinataire',
      dataKey: 'latest_intermediaire_signed_at',
      title: 'Date dernière décision dest.',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'intermediaire_carcasse_refus_motif',
      label: 'Motif de refus d’un destinataire',
      dataKey: 'intermediaire_carcasse_refus_motif',
      title: 'Motif de refus dest.',
    },
    {
      key: 'svi_carcasse_status',
      label: 'Statut SVI',
      dataKey: 'svi_carcasse_status',
      title: 'Statut',
      sortable: true,
      render: (carcasse) => getCarcasseStatusLabel(carcasse),
    },
    {
      key: 'svi_carcasse_status_set_at',
      label: 'Date de décision SVI',
      dataKey: 'svi_carcasse_status_set_at',
      title: 'Date décision SVI',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'svi_carcasse_archived',
      label: 'Carcasse archivée',
      dataKey: 'svi_carcasse_archived',
      title: 'Archivé(e)',
      sortable: true,
      render: (carcasse) => (isCarcasseSviArchived(carcasse) ? 'Oui' : 'Non'),
    },
    {
      key: 'svi_carcasse_commentaire',
      label: 'Commentaire SVI',
      dataKey: 'svi_carcasse_commentaire',
      title: 'Commentaire SVI',
    },
    {
      key: 'svi_ipm1_decision',
      label: 'Décision IPM1',
      dataKey: 'svi_ipm1_decision',
      title: 'Décision IPM1',
    },
    {
      key: 'svi_ipm1_lesions_ou_motifs',
      label: 'Lésions / motifs IPM1',
      dataKey: 'svi_ipm1_lesions_ou_motifs',
      title: 'Motifs IPM1',
      render: (carcasse) => (carcasse.svi_ipm1_lesions_ou_motifs ?? []).filter(Boolean).join(', ') || '-',
    },
    {
      key: 'svi_ipm2_decision',
      label: 'Décision IPM2',
      dataKey: 'svi_ipm2_decision',
      title: 'Décision IPM2',
    },
    {
      key: 'svi_ipm2_lesions_ou_motifs',
      label: 'Lésions / motifs IPM2',
      dataKey: 'svi_ipm2_lesions_ou_motifs',
      title: 'Motifs IPM2',
      render: (carcasse) => (carcasse.svi_ipm2_lesions_ou_motifs ?? []).filter(Boolean).join(', ') || '-',
    },
    {
      key: 'svi_closed_at',
      label: 'Date de clôture de la fiche',
      dataKey: 'svi_closed_at',
      title: 'Date clôture fiche',
      type: 'datetime',
      sortable: true,
    },
    {
      key: 'fei_numero',
      label: 'Numéro de fiche',
      dataKey: 'fei_numero',
      title: 'Numéro de fiche',
      sortable: true,
      render: (carcasse) => <Link to={`/app/etg/fei/${carcasse.fei_numero}`}>{carcasse.fei_numero}</Link>,
    },
  ];
}
