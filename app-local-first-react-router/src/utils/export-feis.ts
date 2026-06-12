import { useState } from 'react';
import { utils, writeFile } from '@e965/xlsx';
import useZustandStore from '@app/zustand/store';
import type { UserForFei } from '~/src/types/user';
import { EntityWithUserRelation } from '@api/src/types/entity';
import { getIntermediaireRoleLabel } from './get-user-roles-label';
import dayjs from 'dayjs';
import { getFeiAndCarcasseAndIntermediaireIdsFromCarcasse } from './get-carcasse-intermediaire-id';
import { filterFeiIntermediaires } from './get-carcasses-intermediaires';
import { capture } from '@app/services/sentry';
import { filterCarcassesForFei } from './get-carcasses-for-fei';
import { IPM1Decision, IPM2Decision, FeiOwnerRole } from '@prisma/client';

type FeiExcelData = {
  Donnée: string;
  Valeur: string | null;
};

type CarcasseExcelData = {
  'Numéro de marquage': string;
  Éspèce: string | null;
  Poids: string | null;
  "Nombre d'animaux": number | null | undefined;
  'Numéro suivi trichine': string | null;
  // Estampille: string | null;
  // infos de SVI
  'SVI - Consigne': string | null;
  'SVI - Motif Consigne': string | null;
  'SVI - Pièces Consigne': string | null;
  'SVI - Motifs Consigne': string | null;
  'SVI - Commentaire': string | null;
  'SVI - Saisie partielle': string | null;
  'SVI - Saisie totale': string | null;
  'SVI - Saisie motif': string;
  'SVI - Certificat de saisie OK': string | null;
  "SVI - Date d'examen": Date | null;
  // infos de chasse
  'Premier détenteur': string;
  'Premier détenteur téléphone': string | null;
  'Premier détenteur email': string | null;
  'Examinateur initial': string;
  'Examinateur initial téléphone': string | null;
  'Examinateur initial email': string | null;
  'Date de la chasse': string;
  'Commune de la chasse': string | null;
  'Numéro de fiche': string;
  // Observations ETG
  'Commentaires ETG / Transporteurs': string | null;
  'Nom du collecteur': string | null;
  // Plus d'infos
  'Heure de première mise à mort': string | null;
  'Heure de dernière éviscération': string | null;
  Réceptionnée: string | null;
  // zacharie_carcasse_id: string;
  // 'Type de gibier': string;
  // 'Examen initial - Anomalies carcasse': string;
  // 'Examen initial - Anomalies abats': string;
  // 'Examen initial - Commentaire': string | null;
  // Manquante: string;
  // 'Refusée par un destinataire': string;
  // Commentaires: string;
};

// Catalogue des colonnes exportables (1 entrée par champ de CarcasseExcelData).
// `key` = slug stable mémorisé dans localStorage, `label` = en-tête FR de la feuille.
// L'ordre du catalogue définit l'ordre de l'export complet (preset par défaut).
export const EXPORT_COLUMNS_CATALOG: Array<{ key: string; label: keyof CarcasseExcelData }> = [
  { key: 'premier_detenteur', label: 'Premier détenteur' },
  { key: 'date_chasse', label: 'Date de la chasse' },
  { key: 'numero_marquage', label: 'Numéro de marquage' },
  { key: 'commentaires_etg', label: 'Commentaires ETG / Transporteurs' },
  { key: 'nom_collecteur', label: 'Nom du collecteur' },
  { key: 'espece', label: 'Éspèce' },
  { key: 'poids', label: 'Poids' },
  { key: 'nombre_animaux', label: "Nombre d'animaux" },
  { key: 'numero_trichine', label: 'Numéro suivi trichine' },
  { key: 'svi_consigne', label: 'SVI - Consigne' },
  { key: 'svi_motif_consigne', label: 'SVI - Motif Consigne' },
  { key: 'svi_pieces_consigne', label: 'SVI - Pièces Consigne' },
  { key: 'svi_motifs_consigne', label: 'SVI - Motifs Consigne' },
  { key: 'svi_commentaire', label: 'SVI - Commentaire' },
  { key: 'svi_saisie_partielle', label: 'SVI - Saisie partielle' },
  { key: 'svi_saisie_totale', label: 'SVI - Saisie totale' },
  { key: 'svi_saisie_motif', label: 'SVI - Saisie motif' },
  { key: 'svi_certificat', label: 'SVI - Certificat de saisie OK' },
  { key: 'svi_date_examen', label: "SVI - Date d'examen" },
  { key: 'commune_chasse', label: 'Commune de la chasse' },
  { key: 'numero_fiche', label: 'Numéro de fiche' },
  { key: 'premier_detenteur_telephone', label: 'Premier détenteur téléphone' },
  { key: 'premier_detenteur_email', label: 'Premier détenteur email' },
  { key: 'examinateur_initial', label: 'Examinateur initial' },
  { key: 'examinateur_telephone', label: 'Examinateur initial téléphone' },
  { key: 'examinateur_email', label: 'Examinateur initial email' },
  { key: 'receptionnee', label: 'Réceptionnée' },
  { key: 'heure_premiere_mise_a_mort', label: 'Heure de première mise à mort' },
  { key: 'heure_derniere_evisceration', label: 'Heure de dernière éviscération' },
];

const catalogByKey: Record<string, (typeof EXPORT_COLUMNS_CATALOG)[number]> = Object.fromEntries(
  EXPORT_COLUMNS_CATALOG.map((c) => [c.key, c])
);

// Preset "export complet" = toutes les colonnes dans l'ordre du catalogue.
export const DEFAULT_EXPORT_COLUMN_KEYS = EXPORT_COLUMNS_CATALOG.map((c) => c.key);

// Preset "export simplifié" = ancien export simplifié (4 colonnes).
export const SIMPLIFIED_EXPORT_COLUMN_KEYS = [
  'premier_detenteur',
  'date_chasse',
  'numero_marquage',
  'espece',
];

function createSheet(data: Array<Record<string, unknown>>) {
  /*
  [
    [the, first, array, is, the, header],
    [then, its, the, data],
  ]
   */

  const header = [
    //   const wscols = header.map((col: keyof CarcasseExcelData | keyof FeiExcelData) => {
    ...data.reduce((columns: Array<string>, item: Record<string, unknown>) => {
      for (let key of Object.keys(item)) {
        if (!columns.find((col) => col === key)) columns.push(key);
      }
      return columns;
    }, []),
  ];

  const rowHeights: Array<{ hpx: number }> = [{ hpx: 20 }]; // first line is header
  const sheet = data.reduce(
    (xlsxData: Array<Array<string | null>>, item: Record<string, unknown>) => {
      const row = [];

      for (let column of header) {
        const value = item[column];
        if (!value) {
          row.push(null);
          continue;
        }
        if (typeof value === 'string') {
          // https://stackoverflow.com/questions/26837514/a-new-idea-on-how-to-beat-the-32-767-text-limit-in-excel
          row.push(value.substring(0, 32766));
          continue;
        }
        if (Array.isArray(value) && typeof value[0] === 'string') {
          row.push(value.join(', ').substring(0, 32766));
          continue;
        }
        row.push(JSON.stringify(value).substring(0, 32766));
      }

      rowHeights.push({
        hpx: Math.max(...row.map((content) => (content || '').split('\n').filter(Boolean).length)) * 20,
      });
      return [...xlsxData, row];
    },
    [header]
  );
  const worksheet = utils.aoa_to_sheet(sheet);
  worksheet['!rows'] = rowHeights;

  // Add cell styling for all cells
  const range = utils.decode_range(worksheet['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = utils.encode_cell({ r: R, c: C });
      if (!worksheet[cell_address]) continue;
      worksheet[cell_address].s = {
        alignment: { wrapText: true, vertical: 'top' },
      };
      // Force text format
      worksheet[cell_address].z = '@';
    }
  }

  // Set column widths
  // col is key of CarcasseExcelData
  const wscols = header.map((col) => {
    switch (col) {
      case 'Donnée':
      case 'Valeur':
      case 'Commentaires ETG / Transporteurs':
      case 'Nom du collecteur':
      case 'SVI - Commentaire':
      case 'SVI - Saisie motif':
      case 'Premier détenteur':
      case 'Premier détenteur téléphone':
      case 'Premier détenteur email':
      case 'Examinateur initial':
      case 'Examinateur initial téléphone':
      case 'Examinateur initial email':
      case 'Commune de la chasse':
      case 'Numéro de fiche':
        return { wch: 40 }; // wider columns for comments
      // case 'Numéro de marquage':
      case 'Poids':
      case 'SVI - Saisie totale':
      case 'SVI - Certificat de saisie OK':
      case "Nombre d'animaux":
      case 'SVI - Consigne':
      case 'SVI - Motif Consigne':
      case 'Date de la chasse':
      case 'Heure de première mise à mort':
      case 'Heure de dernière éviscération':
        return { wch: 15 };
      // case 'Refusée par un destinataire':
      case 'Numéro suivi trichine':
      case 'Numéro de marquage':
      case 'Éspèce':
      case 'SVI - Saisie partielle':
      case 'SVI - Pièces Consigne':
      case 'SVI - Motifs Consigne':
      case "SVI - Date d'examen":
      default:
        return { wch: 20 }; // default width
    }
  });
  worksheet['!cols'] = wscols;

  // Add cell styling for all cells
  // const range = utils.decode_range(worksheet['!ref'] || 'A1');
  // for (let R = range.s.r; R <= range.e.r; ++R) {
  //   for (let C = range.s.c; C <= range.e.c; ++C) {
  //     const cell_address = utils.encode_cell({ r: R, c: C });
  //     if (!worksheet[cell_address]) continue;
  //     worksheet[cell_address].s = {
  //       alignment: { wrapText: true },
  //     };
  //   }
  // }

  return worksheet;
}

function formatUser(user: UserForFei | null) {
  if (!user) return null;
  return `${user?.prenom} ${user?.nom_de_famille}\n${user?.email}\n${user?.telephone}`;
}

function formatEntity(entity: EntityWithUserRelation | null) {
  if (!entity) return null;
  let line1 = `${entity?.nom_d_usage}`;
  let line2 = entity?.address_ligne_1;
  if (entity?.address_ligne_2) {
    line2 += `\n${entity?.address_ligne_2}`;
  }
  let line3 = `${entity?.code_postal} ${entity?.ville}`;
  return `${line1}\n${line2}\n${line3}`;
}

function sortCarcassesApprovedForExcel(carcasseA: CarcasseExcelData, carcasseB: CarcasseExcelData) {
  if (carcasseA.Réceptionnée && carcasseB.Réceptionnée) {
    return carcasseA.Réceptionnée.localeCompare(carcasseB.Réceptionnée);
  }
  if (carcasseA.Éspèce === carcasseB.Éspèce) {
    return carcasseA['Numéro de marquage'].localeCompare(carcasseB['Numéro de marquage']);
  }
  return carcasseA.Éspèce!.localeCompare(carcasseB.Éspèce!);
}

export default function useExportFeis() {
  let [isExporting, setIsExporting] = useState(false);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const users = useZustandStore((state) => state.users);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);

  async function onExportToXlsx(feiNumbers: Array<string>, columnKeys: Array<string>) {
    setIsExporting(true);
    // just to trigger the loading state, sorry Raph :)
    await new Promise((res) => setTimeout(res));

    const carcassesWorkbook = utils.book_new();
    const feiSheets: Record<string, Array<FeiExcelData>> = {};
    const allCarcasses: Array<CarcasseExcelData> = [];

    try {
      for (const feiId of feiNumbers) {
        let fei = feis[feiId!]!;
        if (!fei) {
          continue;
        }

        const feiSheetData = [
          {
            Donnée: 'Date de la chasse',
            Valeur: dayjs(fei.date_mise_a_mort).format('dddd D MMMM YYYY'),
          },
          {
            Donnée: 'Heure de première mise à mort',
            Valeur: fei.heure_mise_a_mort_premiere_carcasse,
          },
          {
            Donnée: 'Heure de dernière éviscération',
            Valeur: fei.heure_evisceration_derniere_carcasse,
          },
          { Donnée: 'Commune', Valeur: fei.commune_mise_a_mort },
        ];
        const examinateurInitial = users[fei.examinateur_initial_user_id!];
        if (examinateurInitial) {
          feiSheetData.push({
            Donnée: 'Examinateur initial',
            Valeur: formatUser(examinateurInitial),
          });
        }
        const premierDetenteur = users[fei.premier_detenteur_user_id!];
        const premierDetenteurEntity = entities[fei.premier_detenteur_entity_id!];
        if (premierDetenteur && premierDetenteurEntity) {
          feiSheetData.push({
            Donnée: 'Premier détenteur',
            Valeur: `${formatEntity(premierDetenteurEntity)}\n${formatUser(premierDetenteur)}`,
          });
        } else if (premierDetenteur) {
          feiSheetData.push({
            Donnée: 'Premier détenteur',
            Valeur: formatUser(premierDetenteur),
          });
        }

        const intermediaires = filterFeiIntermediaires(carcassesIntermediaireById, fei.numero);
        if (intermediaires.length > 0) {
          for (const [index, intermediaire] of Object.entries(intermediaires)) {
            const intermediaireEntity = entities[intermediaire.intermediaire_entity_id];
            const intermediaireUser = users[intermediaire.intermediaire_user_id!];
            feiSheetData.push({
              Donnée: `Destinataire ${Number(index) + 1}`,
              Valeur: `${getIntermediaireRoleLabel(intermediaire.intermediaire_role!)}\n${formatEntity(intermediaireEntity)}\n${formatUser(intermediaireUser)}`,
            });
          }
        } else {
          feiSheetData.push({
            Donnée: 'Destinataire',
            Valeur: 'Pas encore réceptionné',
          });
        }

        const sviEntity = entities[fei.svi_entity_id!];
        feiSheetData.push({
          Donnée: 'SVI',
          Valeur: formatEntity(sviEntity) || 'Pas encore désigné',
        });

        feiSheets[fei.numero] = feiSheetData;

        for (const carcasse of filterCarcassesForFei(useZustandStore.getState().carcasses, fei.numero)) {
          if (!carcasse) {
            continue;
          }
          if (carcasse.deleted_at) {
            console.error('carcasse deleted', carcasse.zacharie_carcasse_id);
            continue;
          }
          if (carcasse.intermediaire_carcasse_manquante) {
            console.error('carcasse manquante', carcasse.zacharie_carcasse_id);
            continue;
          }
          if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
            console.error('carcasse refusée', carcasse.zacharie_carcasse_id);
            continue;
          }
          const commentaires = [];
          let poids = undefined;
          const collecteursPro: string[] = [];
          for (const intermediaire of intermediaires) {
            const id = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(carcasse, intermediaire.id);
            const intermediaireCarcasse = carcassesIntermediaireById[id];
            if (intermediaireCarcasse?.commentaire) {
              const intermediaireEntity = entities[intermediaire.intermediaire_entity_id];
              commentaires.push(
                `${intermediaireEntity?.nom_d_usage}\u00A0: ${intermediaireCarcasse?.commentaire}`
              );
            }
            if (intermediaireCarcasse?.intermediaire_poids) {
              poids = intermediaireCarcasse.intermediaire_poids;
            }
            // Récupérer le nom du collecteur pro si présent
            if (intermediaire.intermediaire_role === FeiOwnerRole.COLLECTEUR_PRO) {
              const collecteurEntity = entities[intermediaire.intermediaire_entity_id];
              if (collecteurEntity?.nom_d_usage) {
                collecteursPro.push(collecteurEntity.nom_d_usage);
              }
            }
          }
          allCarcasses.push({
            'Premier détenteur':
              premierDetenteurEntity?.nom_d_usage ||
              (premierDetenteur?.nom_de_famille
                ? `${premierDetenteur?.prenom} ${premierDetenteur?.nom_de_famille}`
                : ''),
            'Date de la chasse': dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY'),
            'Numéro de marquage': carcasse.numero_bracelet,
            'Commentaires ETG / Transporteurs': commentaires.join('\n'),
            'Nom du collecteur': collecteursPro.length > 0 ? collecteursPro.join(', ') : null,
            Éspèce: carcasse.espece,
            Poids: poids ? poids.toString() : null,
            "Nombre d'animaux": carcasse.nombre_d_animaux || 1,
            'Numéro suivi trichine': '',
            // Estampille: '',
            // infos de SVI
            'SVI - Consigne': carcasse.svi_ipm1_decision?.includes(IPM1Decision.MISE_EN_CONSIGNE)
              ? 'Oui'
              : '',
            'SVI - Motif Consigne': 'BA P S OA CA pap', // colonne pré-remplie pour entourage manuscrit à l'impression
            'SVI - Pièces Consigne': carcasse.svi_ipm1_pieces.join('\n') || null,
            'SVI - Motifs Consigne': carcasse.svi_ipm1_lesions_ou_motifs.join('\n') || null,
            'SVI - Commentaire': carcasse.svi_carcasse_commentaire,
            'SVI - Saisie partielle': carcasse.svi_ipm2_decision?.includes(IPM2Decision.SAISIE_PARTIELLE)
              ? carcasse.svi_ipm2_pieces.join(' - ')
              : '',
            'SVI - Saisie totale': carcasse.svi_ipm2_decision?.includes(IPM2Decision.SAISIE_TOTALE)
              ? 'Oui'
              : '',
            'SVI - Saisie motif': carcasse.svi_ipm2_lesions_ou_motifs.join('\n'),
            'SVI - Certificat de saisie OK': '',
            "SVI - Date d'examen": carcasse.svi_ipm2_date,
            // infos de chasse
            'Commune de la chasse': fei.commune_mise_a_mort,
            'Numéro de fiche': fei.numero,
            'Premier détenteur téléphone': premierDetenteur?.telephone || '',
            'Premier détenteur email': premierDetenteur?.email || '',
            'Examinateur initial': examinateurInitial
              ? `${examinateurInitial.prenom} ${examinateurInitial.nom_de_famille}`
              : '',
            'Examinateur initial téléphone': examinateurInitial?.telephone || '',
            'Examinateur initial email': examinateurInitial?.email || '',
            // Observations ETG
            Réceptionnée: carcasse.latest_intermediaire_signed_at
              ? dayjs(carcasse.latest_intermediaire_signed_at).format('DD/MM/YYYY HH:mm')
              : null,
            // Plus d'infos
            'Heure de première mise à mort': fei.heure_mise_a_mort_premiere_carcasse,
            'Heure de dernière éviscération': fei.heure_evisceration_derniere_carcasse,
            // 'Examen initial - Anomalies carcasse': carcasse.examinateur_anomalies_carcasse.join(', '),
            // 'Examen initial - Anomalies abats': carcasse.examinateur_anomalies_abats.join(', '),
            // 'Examen initial - Commentaire': carcasse.examinateur_commentaire,
            // Manquante: '';
            // 'Refusée par un destinataire': '';
            // Commentaires: '';
          });
        }
      }

      // Projection sur les colonnes choisies, dans l'ordre choisi.
      const keys = columnKeys?.length ? columnKeys : DEFAULT_EXPORT_COLUMN_KEYS;
      const labelsInOrder = keys
        .map((k) => catalogByKey[k]?.label)
        .filter((l): l is keyof CarcasseExcelData => Boolean(l));
      const projectedCarcasses = allCarcasses.sort(sortCarcassesApprovedForExcel).map((record) => {
        const row: Record<string, unknown> = {};
        for (const label of labelsInOrder) {
          row[label] = record[label];
        }
        return row;
      });

      utils.book_append_sheet(carcassesWorkbook, createSheet(projectedCarcasses), 'Carcasses', true);

      for (const [feiNumero, feiSheetData] of Object.entries(feiSheets)) {
        utils.book_append_sheet(carcassesWorkbook, createSheet(feiSheetData), feiNumero, true);
      }

      writeFile(carcassesWorkbook, `export-carcasses-zacharie-${dayjs().format('YYYY-MM-DD-HH-mm')}.xlsx`, {
        cellStyles: true,
        bookSST: true,
      });
      setIsExporting(false);
      return true;

      // actions
    } catch (e: unknown) {
      capture(e as Error);
      alert(
        "Une erreur est survenue lors de l'exportation des fiches. L'équipe technique a été notifiée. Veuillez nous excuser pour la gêne occasionnée, et réessayer plus tard"
      );
    }
    setIsExporting(false);
    return false;
  }

  return {
    isExporting,
    onExportToXlsx,
  };
}
