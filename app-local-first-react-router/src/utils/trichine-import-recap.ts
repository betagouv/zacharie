import type { LimsResultRow, PoolResultEffet } from '@api/src/types/responses';

export type ImportRecap = {
  pools: number;
  carcasses: Record<PoolResultEffet, number>;
  confirmationsLnr: number;
  ftpsCloturees: Array<string>;
};

/**
 * Récapitulatif de ce que l'import des lignes cochées va faire dans Zacharie.
 * Une fiche reçue se clôture quand tous ses pools sans résultat en reçoivent un dans l'import.
 */
export function computeImportRecap(selectedRows: Array<LimsResultRow>): ImportRecap {
  const carcasses: Record<PoolResultEffet, number> = {
    liberees: 0,
    en_attente_confirmation: 0,
    a_saisir: 0,
    decision_a_prendre: 0,
  };
  const poolsImportes = new Set<string>();
  const ftps = new Map<string, NonNullable<LimsResultRow['ftp']>>();
  for (const row of selectedRows) {
    if (row.effet) carcasses[row.effet] += row.nb_carcasses ?? 0;
    if (row.reference_pool_zacharie) poolsImportes.add(row.reference_pool_zacharie);
    if (row.ftp) ftps.set(row.ftp.numero_fiche, row.ftp);
  }
  const ftpsCloturees = [...ftps.values()]
    .filter((ftp) => ftp.recue && ftp.pools_sans_resultat.every((reference) => poolsImportes.has(reference)))
    .map((ftp) => ftp.numero_fiche);
  return {
    pools: poolsImportes.size,
    carcasses,
    confirmationsLnr: selectedRows.filter((row) => row.effet === 'en_attente_confirmation').length,
    ftpsCloturees,
  };
}
