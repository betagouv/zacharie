import { useState } from 'react';
import { utils, writeFile } from '@e965/xlsx';
import useZustandStore from '@app/zustand/store';
import type { UserForFei } from '~/src/types/user';
import { EntityWithUserRelation } from '@api/src/types/entity';
import { getUserRoleLabel } from './get-user-roles-label';
import dayjs from 'dayjs';
import { getFeiAndCarcasseAndIntermediaireIdsFromCarcasse } from './get-carcasse-intermediaire-id';
import { loadFei } from './load-fei';
import { capture } from '@app/services/sentry';
import { IPM1Decision, IPM2Decision } from '@prisma/client';

type FeiExcelData = {
  Donnée: string;
  Valeur: string | null;
};

type CarcasseExcelData = {
  'Numéro de bracelet': string;
  Éspèce: string | null;
  "Nombre d'animaux": number | null | undefined;
  'Numéro suivi trichine': string | null;
  // Estampille: string | null;
  // infos de SVI
  'SVI - Consigne': string | null;
  'SVI - Motif Consigne': string | null;
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

function createSheet<T extends keyof CarcasseExcelData | keyof FeiExcelData>(
  data: Array<Record<T, unknown>>,
) {
  /*
  [
    [the, first, array, is, the, header],
    [then, its, the, data],
  ]
   */

  const header = [
    //   const wscols = header.map((col: keyof CarcasseExcelData | keyof FeiExcelData) => {
    ...data.reduce((columns: Array<T>, item: Record<T, unknown>) => {
      for (let key of Object.keys(item)) {
        if (!columns.find((col) => col === key)) columns.push(key as T);
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
    [header],
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
      // case 'Numéro de bracelet':
      case 'SVI - Saisie totale':
      case 'SVI - Certificat de saisie OK':
      case "Nombre d'animaux":
      case 'SVI - Consigne':
      case 'Date de la chasse':
      case 'Heure de première mise à mort':
      case 'Heure de dernière éviscération':
        return { wch: 15 };
      // case 'Refusée par un destinataire':
      case 'Numéro suivi trichine':
      case 'Numéro de bracelet':
      case 'Éspèce':
      case 'SVI - Saisie partielle':
      case 'SVI - Motif Consigne':
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
    return carcasseA['Numéro de bracelet'].localeCompare(carcasseB['Numéro de bracelet']);
  }
  return carcasseA.Éspèce!.localeCompare(carcasseB.Éspèce!);
}

export default function useExportFeis() {
  let [isExporting, setIsExporting] = useState(false);
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const feis = useZustandStore((state) => state.feis);
  const entities = useZustandStore((state) => state.entities);
  const users = useZustandStore((state) => state.users);
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const carcassesIntermediaireById = useZustandStore((state) => state.carcassesIntermediaireById);
  const carcasses = useZustandStore((state) => state.carcasses);

  async function onExportToXlsx(feiNumbers: Array<string>) {
    setIsExporting(true);
    // just to trigger the loading state, sorry Raph :)
    await new Promise((res) => setTimeout(res));

    const carcassesWorkbook = utils.book_new();
    const feiSheets: Record<string, Array<FeiExcelData>> = {};
    const allCarcasses: Array<CarcasseExcelData> = [];

    try {
      for (const feiId of feiNumbers) {
        let fei = null;
        fei = feis[feiId!];
        if (!fei) {
          fei = await loadFei(feiId);
          if (!fei) {
            console.error('fei not found', feiId);
            continue;
          }
        }

        const feiSheetData = [
          {
            Donnée: 'Date de la chasse',
            Valeur: dayjs(fei.date_mise_a_mort).format('dddd DD MMMM YYYY'),
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

        const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
        if (intermediaires.length > 0) {
          for (const [index, intermediaire] of Object.entries(intermediaires)) {
            const intermediaireEntity = entities[intermediaire.intermediaire_entity_id];
            const intermediaireUser = users[intermediaire.intermediaire_user_id!];
            feiSheetData.push({
              Donnée: `Destinataire ${Number(index) + 1}`,
              Valeur: `${getUserRoleLabel(intermediaire.intermediaire_role!)}\n${formatEntity(intermediaireEntity)}\n${formatUser(intermediaireUser)}`,
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

        for (const carcasseId of carcassesIdsByFei[fei.numero] || []) {
          const carcasse = carcasses[carcasseId];
          if (!carcasse) {
            console.error('carcasse not found', carcasseId);
            continue;
          }
          if (carcasse.deleted_at) {
            console.error('carcasse deleted', carcasseId);
            continue;
          }
          if (carcasse.intermediaire_carcasse_manquante) {
            console.error('carcasse manquante', carcasseId);
            continue;
          }
          if (carcasse.intermediaire_carcasse_refus_motif) {
            console.error('carcasse refusée', carcasseId);
            continue;
          }
          const commentaires = [];
          for (const intermediaire of intermediaires) {
            const id = getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(carcasse, intermediaire.id);
            const intermediaireCarcasse = carcassesIntermediaireById[id];
            if (intermediaireCarcasse?.commentaire) {
              const intermediaireEntity = entities[intermediaire.intermediaire_entity_id];
              commentaires.push(
                `${intermediaireEntity?.nom_d_usage} : ${intermediaireCarcasse?.commentaire}`,
              );
            }
          }
          allCarcasses.push({
            'Premier détenteur':
              premierDetenteurEntity?.nom_d_usage ||
              (premierDetenteur?.nom_de_famille
                ? `${premierDetenteur?.prenom} ${premierDetenteur?.nom_de_famille}`
                : ''),
            'Date de la chasse': dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY'),
            'Numéro de bracelet': carcasse.numero_bracelet,
            'Commentaires ETG / Transporteurs': commentaires.join('\n'),
            Éspèce: carcasse.espece,
            "Nombre d'animaux": carcasse.nombre_d_animaux || 1,
            'Numéro suivi trichine': '',
            // Estampille: '',
            // infos de SVI
            'SVI - Consigne': carcasse.svi_ipm1_decision?.includes(IPM1Decision.MISE_EN_CONSIGNE)
              ? 'Oui'
              : '',
            'SVI - Motif Consigne': 'BA P S OA CA pap',
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

      utils.book_append_sheet(
        carcassesWorkbook,
        createSheet(allCarcasses.sort(sortCarcassesApprovedForExcel)),
        'Carcasses',
        true,
      );

      for (const [feiNumero, feiSheetData] of Object.entries(feiSheets)) {
        utils.book_append_sheet(carcassesWorkbook, createSheet(feiSheetData), feiNumero, true);
      }

      writeFile(carcassesWorkbook, `export-carcasses-zacharie-${dayjs().format('YYYY-MM-DD-HH-mm')}.xlsx`, {
        cellStyles: true,
        bookSST: true,
      });
      return setIsExporting(false);

      // actions
    } catch (e: unknown) {
      capture(e as Error);
      alert(
        "Une erreur est survenue lors de l'exportation des fiches. L'équipe technique a été notifiée. Veuillez nous excuser pour la gêne occasionnée, et réessayer plus tard",
      );
    }
    setIsExporting(false);
  }

  return {
    isExporting,
    onExportToXlsx,
  };
}
