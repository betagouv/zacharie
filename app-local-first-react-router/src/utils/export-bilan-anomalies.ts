import { useState } from 'react';
import { toast } from 'react-toastify';
import { utils, writeFile, type CellObject, type WorkSheet } from '@e965/xlsx';
import API from '@app/services/api';
import { capture } from '@app/services/sentry';
import type { BilanAnomaliesData, BilanAnomaliesResponse } from '@api/src/types/responses';

// Bilan des anomalies de fin de saison demandé par la DGAL (calque "bilan des anomalies") :
// un onglet par chapitre du calque, une ligne par ETG et groupe d'espèces.
// Les cellules vides sont les données absentes de Zacharie, à compléter par le SVI.

type Cell = string | number | CellObject;

function taux(numerateurCol: string, denominateurCol: string, row: number): CellObject {
  return {
    t: 'n',
    f: `IF(${denominateurCol}${row}>0,${numerateurCol}${row}/${denominateurCol}${row},"")`,
    z: '0.0%',
  };
}

function buildSheet(header: Array<string>, rows: Array<Array<Cell>>): WorkSheet {
  const sheet = utils.aoa_to_sheet([header, ...rows]);
  sheet['!cols'] = header.map((_, index) => ({ wch: index === 0 ? 30 : 18 }));
  sheet['!autofilter'] = {
    ref: utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }),
  };
  return sheet;
}

function buildWorkbook({ lignes, colonnes_anomalies }: BilanAnomaliesData) {
  const workbook = utils.book_new();
  const etgColumns = ['ETG', 'Département', 'Espèce'];

  // Chapitre I : colonnes D à H, taux de saisie rapportés aux carcasses réceptionnées (D).
  utils.book_append_sheet(
    workbook,
    buildSheet(
      [
        ...etgColumns,
        'Nbre de carcasses réceptionnées',
        'Nbre de carcasses contrôlées',
        'Nbre de saisies partielles',
        'Nbre de saisies totales',
        "Nbre de carcasses ayant fait l'objet d'une saisie dont les anomalies n'ont pas été signalées sur la FEI",
        'Taux de saisies partielles',
        'Taux de saisies totales',
      ],
      lignes.map((ligne, index) => [
        ligne.etg_nom,
        ligne.etg_departement ?? '',
        ligne.groupe_espece,
        ligne.receptionnees,
        ligne.controlees,
        ligne.saisies_partielles,
        ligne.saisies_totales,
        ligne.saisies_non_signalees_fei,
        taux('F', 'D', index + 2),
        taux('G', 'D', index + 2),
      ])
    ),
    'I - Données générales'
  );

  utils.book_append_sheet(
    workbook,
    buildSheet(
      [
        ...etgColumns,
        "Absence de fiche d'EI",
        "Fiche d'EI non reconnue valide",
        'Partie « Circuit de commercialisation » incomplète',
        "Absence d'identification des venaisons",
        "Destination des venaisons incompatible avec le résultat de l'EI",
        'Autre',
        "Nbre de saisies totales liées à des anomalies relatives à la fiche d'EI",
      ],
      lignes.map((ligne) => [
        ligne.etg_nom,
        ligne.etg_departement ?? '',
        ligne.groupe_espece,
        '',
        ligne.ei_non_valide,
        '',
        ligne.ei_non_identifiee,
        '',
        '',
        ligne.saisies_totales_ei,
      ])
    ),
    'II - Examen initial'
  );

  utils.book_append_sheet(
    workbook,
    buildSheet(
      [...etgColumns, ...colonnes_anomalies, 'Autres motifs', 'Détail des autres motifs'],
      lignes.map((ligne) => {
        const autresMotifs = Object.entries(ligne.autres_motifs).sort(([, a], [, b]) => b - a);
        return [
          ligne.etg_nom,
          ligne.etg_departement ?? '',
          ligne.groupe_espece,
          ...colonnes_anomalies.map((colonne) => ligne.anomalies[colonne] ?? ''),
          autresMotifs.reduce((total, [, count]) => total + count, 0),
          autresMotifs.map(([motif, count]) => `${motif} (${count})`).join(' ; '),
        ];
      })
    ),
    'III - Anomalies carcasses'
  );

  return workbook;
}

export default function useExportBilanAnomalies(path: 'svi/bilan-anomalies' | 'admin/bilan-anomalies') {
  const [isExporting, setIsExporting] = useState(false);

  async function exportBilanAnomalies(saison: number) {
    setIsExporting(true);
    try {
      const res = (await API.get({ path, query: { saison: String(saison) } })) as BilanAnomaliesResponse;
      if (!res.ok || !res.data) {
        toast.error(res.error || "Le bilan de saison n'a pas pu être généré");
        return;
      }
      writeFile(
        buildWorkbook(res.data),
        `Zacharie - Bilan des anomalies - saison ${saison}-${saison + 1}.xlsx`
      );
    } catch (error) {
      capture(error as Error, { extra: { path, saison } });
      toast.error("Le bilan de saison n'a pas pu être généré");
    } finally {
      setIsExporting(false);
    }
  }

  return { isExporting, exportBilanAnomalies };
}
