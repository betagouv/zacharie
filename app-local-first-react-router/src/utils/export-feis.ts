import { useState } from 'react';
import { utils, write, writeFile } from '@e965/xlsx';
import useZustandStore from '@app/zustand/store';
import type { UserForFei } from '~/src/types/user';
import { EntityWithUserRelation } from '@api/src/types/entity';
import { getUserRoleLabel } from './get-user-roles-label';
import dayjs from 'dayjs';
import JSZip from 'jszip';
import { getCarcasseIntermediaireId } from './get-carcasse-intermediaire-id';
import { loadFei } from './load-fei';
import { capture } from '@app/services/sentry';

function createSheet(data: Array<Record<string, unknown>>) {
  /*
  [
    [the, first, array, is, the, header],
    [then, its, the, data],
  ]
   */

  const header = [
    ...data.reduce((columns: Array<string>, item: Record<string, unknown>) => {
      for (let key of Object.keys(item)) {
        if (!columns.find((col) => col === key)) columns.push(key);
      }
      return columns;
    }, []),
  ];

  const rowHeights: Array<{ hpx: number }> = [{ hpx: 20 }]; // first line is header
  const sheet = data.reduce(
    (xlsxData: Array<Array<string | null>>, item: Record<string, unknown>, index: number) => {
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
  const wscols = header.map((col) => {
    switch (col) {
      case 'Commentaires':
      case 'Donnée':
      case 'Valeur':
      case 'SVI - Commentaire':
      case 'Examen initial - Anomalies carcasse':
      case 'Examen initial - Anomalies abats':
      case 'Examen initial - Commentaire':
      case 'SVI - Saisie':
      case 'SVI - Saisie motif':
        return { wch: 40 }; // wider columns for comments
      case 'zacharie_carcasse_id':
        return { wch: 30 }; // wider columns for comments
      // case 'Numéro de bracelet':
      case 'Éspèce':
      case 'Type de gibier':
      case "Nombre d'animaux":
      case 'Manquante':
        return { wch: 15 };
      // case 'Refusée par un destinataire':
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

export default function useExportFeis() {
  let [isExporting, setIsExporting] = useState(false);
  const state = useZustandStore((state) => state);
  const feis = state.feis;
  const entities = state.entities;
  const users = state.users;

  async function onExportToXlsx(feiNumbers: Array<string>) {
    setIsExporting(true);
    // just to trigger the loading state, sorry Raph :)
    await new Promise((res) => setTimeout(res));

    const zip = new JSZip();

    const carcassesWorkbook = utils.book_new();
    const allCarcasses:
      | Record<string, unknown>[]
      | {
          'Numéro de fiche': string;
          'Date de la chasse': string;
          'Heure de première mise à mort': string | null;
          'Heure de dernière éviscération': string | null;
          Commune: string | null;
          // zacharie_carcasse_id: string;
          'Numéro de bracelet': string;
          Éspèce: string | null;
          // 'Type de gibier': string;
          "Nombre d'animaux": number | null;
          'Examen initial - Anomalies carcasse': string;
          'Examen initial - Anomalies abats': string;
          'Examen initial - Commentaire': string | null;
          Manquante: string;
          'Refusée par un destinataire': string;
          Commentaires: string;
          'SVI - Saisie': string;
          'SVI - Saisie motif': string;
          'SVI - Commentaire': string | null;
          'SVI - Date de signature': Date | null;
        }[] = [];

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
        const workbook = utils.book_new();

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
          feiSheetData.push({ Donnée: 'Examinateur initial', Valeur: formatUser(examinateurInitial) });
        }
        const premierDetenteur = users[fei.premier_detenteur_user_id!];
        const premierDetenteurEntity = entities[fei.premier_detenteur_entity_id!];
        if (premierDetenteur && premierDetenteurEntity) {
          feiSheetData.push({
            Donnée: 'Premier détenteur',
            Valeur: `${formatEntity(premierDetenteurEntity)}\n${formatUser(premierDetenteur)}`,
          });
        } else if (premierDetenteur) {
          feiSheetData.push({ Donnée: 'Premier détenteur', Valeur: formatUser(premierDetenteur) });
        }

        const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);
        if (intermediaires.length > 0) {
          for (const [index, intermediaire] of Object.entries(intermediaires)) {
            const intermediaireEntity = entities[intermediaire.fei_intermediaire_entity_id];
            const intermediaireUser = users[intermediaire.fei_intermediaire_user_id!];
            feiSheetData.push({
              Donnée: `Destinataire ${Number(index) + 1}`,
              Valeur: `${getUserRoleLabel(intermediaire.fei_intermediaire_role!)}\n${formatEntity(intermediaireEntity)}\n${formatUser(intermediaireUser)}`,
            });
          }
        } else {
          feiSheetData.push({ Donnée: 'Destinataire', Valeur: 'Pas encore réceptionné' });
        }

        const sviEntity = entities[fei.svi_entity_id!];
        feiSheetData.push({
          Donnée: 'SVI',
          Valeur: formatEntity(sviEntity) || 'Pas encore désigné',
        });

        utils.book_append_sheet(workbook, createSheet(feiSheetData), 'Données de chasse');
        utils.book_append_sheet(carcassesWorkbook, createSheet(feiSheetData), fei.numero);

        const carcasses = (state.carcassesIdsByFei[fei.numero] || [])
          .map((carcasseId) => {
            const carcasse = state.carcasses[carcasseId];
            if (carcasse.deleted_at) return null;
            const commentaires = [];
            for (const intermediaire of intermediaires) {
              if (intermediaire.deleted_at) continue;
              const carcassesIntermediairesId = getCarcasseIntermediaireId(
                fei.numero,
                carcasse.numero_bracelet,
                intermediaire.id,
              );
              const intermediaireCarcasse = state.carcassesIntermediaires[carcassesIntermediairesId];
              if (intermediaireCarcasse?.commentaire) {
                const intermediaireEntity = state.entities[intermediaire.fei_intermediaire_entity_id];
                commentaires.push(
                  `${intermediaireEntity?.nom_d_usage} : ${intermediaireCarcasse?.commentaire}`,
                );
              }
            }
            const toReturn = {
              // zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
              'Numéro de bracelet': carcasse.numero_bracelet,
              Éspèce: carcasse.espece,
              // 'Type de gibier': carcasse.type === CarcasseType.PETIT_GIBIER ? 'Petit gibier' : 'Gros gibier',
              "Nombre d'animaux": carcasse.nombre_d_animaux,
              'Premier détenteur':
                premierDetenteurEntity?.nom_d_usage || premierDetenteur?.nom_de_famille
                  ? `${premierDetenteur?.prenom} ${premierDetenteur?.nom_de_famille}`
                  : '',
              Manquante: carcasse.intermediaire_carcasse_manquante ? 'Oui' : '',
              'Refusée par un destinataire': carcasse.intermediaire_carcasse_refus_motif || '',
              'SVI - Saisie': carcasse.svi_carcasse_saisie.join(' - '),
              'SVI - Saisie motif': carcasse.svi_carcasse_saisie_motif.join('\n'),
              'SVI - Commentaire': carcasse.svi_carcasse_commentaire,
              'SVI - Date de signature': carcasse.svi_carcasse_signed_at,
              'Examen initial - Anomalies carcasse': carcasse.examinateur_anomalies_carcasse.join(', '),
              'Examen initial - Anomalies abats': carcasse.examinateur_anomalies_abats.join(', '),
              'Examen initial - Commentaire': carcasse.examinateur_commentaire,
              Commentaires: commentaires.join('\n'),
            };
            allCarcasses.push({
              ...toReturn,
              'Numéro de fiche': fei.numero,
              'Date de la chasse': dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY'),
              'Heure de première mise à mort': fei.heure_mise_a_mort_premiere_carcasse,
              'Heure de dernière éviscération': fei.heure_evisceration_derniere_carcasse,
              Commune: fei.commune_mise_a_mort,
            });
            return toReturn;
          })
          .filter((carcasse) => carcasse !== null);

        utils.book_append_sheet(workbook, createSheet(carcasses), 'Carcasses');
        const fileName = `Fiche ${fei.numero} - ${dayjs(fei.updated_at).format('YYYY-MM-DD-HH-mm')}.xlsx`;

        if (feiNumbers.length > 1) {
          const buffer = write(workbook, { type: 'buffer', cellStyles: true, bookSST: true });
          zip.file(fileName, buffer);
        } else {
          writeFile(workbook, fileName, { cellStyles: true, bookSST: true });
          return setIsExporting(false);
        }
      }

      utils.book_append_sheet(carcassesWorkbook, createSheet(allCarcasses), 'Carcasses');
      // Move the sheet to the first position
      const wb = carcassesWorkbook;
      const lastSheet = wb.SheetNames[wb.SheetNames.length - 1];
      wb.SheetNames.pop();
      wb.SheetNames.unshift(lastSheet);

      zip.file('Carcasses.xlsx', write(carcassesWorkbook, { type: 'buffer' }));

      // Generate zip blob
      const zipContent = await zip.generateAsync({ type: 'blob' });

      // Create download link and trigger download
      const downloadUrl = URL.createObjectURL(zipContent);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `exports-zacharie-${dayjs().format('YYYY-MM-DD-HH-mm')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

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
