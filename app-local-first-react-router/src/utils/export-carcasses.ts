import { useState } from 'react';
import { utils, writeFile } from '@e965/xlsx';
import dayjs from 'dayjs';
import { capture } from '@app/services/sentry';
import { CarcasseForResponseForRegistry } from '@api/src/types/carcasse';
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
  'Archivé(e)': string | null;
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
      case 'Commune de la chasse':
      case 'Numéro de fiche':
        return { wch: 40 }; // wider columns for comments
      // case 'Numéro de bracelet':
      // case 'Estampille':
      case 'SVI - Saisie totale':
      case 'SVI - Certificat de saisie OK':
      case 'Archivé(e)':
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

export default function useExportCarcasses() {
  let [isExporting, setIsExporting] = useState(false);

  async function onExportToXlsx(carcasses: Array<CarcasseForResponseForRegistry>) {
    setIsExporting(true);
    // just to trigger the loading state, sorry Raph :)
    await new Promise((res) => setTimeout(res));

    const carcassesWorkbook = utils.book_new();
    const allCarcasses: Array<CarcasseExcelData> = [];

    try {
      for (const carcasse of carcasses) {
        if (carcasse.deleted_at) {
          console.error('carcasse deleted', carcasse.zacharie_carcasse_id);
          continue;
        }

        allCarcasses.push({
          'Premier détenteur': carcasse.fei_premier_detenteur_name_cache || '',
          'Date de la chasse': dayjs(carcasse.fei_date_mise_a_mort).format('DD/MM/YYYY'),
          'Numéro de bracelet': carcasse.numero_bracelet,
          Éspèce: carcasse.espece,
          "Nombre d'animaux": carcasse.nombre_d_animaux || 1,
          'Numéro suivi trichine': '',
          // Estampille: '',
          // infos de SVI
          'Archivé(e)': carcasse.svi_carcasse_archived ? 'Oui' : '',
          'SVI - Consigne': carcasse.svi_ipm1_decision?.includes(IPM1Decision.MISE_EN_CONSIGNE) ? 'Oui' : '',
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
          "SVI - Date d'examen": carcasse.svi_ipm2_date || carcasse.svi_ipm1_date,
          // infos de chasse
          'Commune de la chasse': carcasse.fei_commune_mise_a_mort,
          'Numéro de fiche': carcasse.fei_numero,
          // Observations ETG
          'Commentaires ETG / Transporteurs': '',
          Réceptionnée: carcasse.intermediaire_carcasse_signed_at
            ? dayjs(carcasse.intermediaire_carcasse_signed_at).format('DD/MM/YYYY HH:mm')
            : null,
          // Plus d'infos
          'Heure de première mise à mort': carcasse.fei_heure_mise_a_mort_premiere_carcasse,
          'Heure de dernière éviscération': carcasse.fei_heure_evisceration_derniere_carcasse,
          // 'Examen initial - Anomalies carcasse': carcasse.examinateur_anomalies_carcasse.join(', '),
          // 'Examen initial - Anomalies abats': carcasse.examinateur_anomalies_abats.join(', '),
          // 'Examen initial - Commentaire': carcasse.examinateur_commentaire,
          // Manquante: '';
          // 'Refusée par un destinataire': '';
          // Commentaires: '';
        });
      }

      utils.book_append_sheet(carcassesWorkbook, createSheet(allCarcasses), 'Carcasses', true);

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
