import dayjs from 'dayjs';
import type { LaboEchantillonRegistre, LaboFTPListItem, LaboPoolRegistre } from '@app/services/laboratoire';
import { monAlias, nomEntiteAlias, type TrichineAlias } from '@app/services/trichine-alias';

/**
 * Export des registres du laboratoire, destiné à l'import dans son LIMS : noms de champs et
 * valeurs d'enums bruts, dates ISO. Le CSV et le JSON portent exactement les mêmes champs ;
 * une liste est un tableau en JSON et des valeurs séparées par `|` en CSV.
 *
 * `reference_labo` est l'alias que le laboratoire a donné à l'objet (le même nom de colonne
 * que l'import de résultats), `autres_references_internes` ceux des autres acteurs.
 */

export type TrichineExportFormat = 'csv' | 'json';

type ExportValue = string | number | boolean | null | Array<string>;
export type ExportRow = Record<string, ExportValue>;

// Champ @db.Date : seule la date compte
function isoDate(value: Date | string | null | undefined): string | null {
  return value ? dayjs(value).format('YYYY-MM-DD') : null;
}

function isoDateTime(value: Date | string | null | undefined): string | null {
  return value ? dayjs(value).toISOString() : null;
}

function aliasesExport(aliases: Array<TrichineAlias>, mesEntites: Array<string>) {
  const mien = monAlias(aliases, mesEntites);
  return {
    reference_labo: mien?.reference ?? null,
    autres_references_internes: aliases
      .filter((alias) => alias.id !== mien?.id)
      .map((alias) => `${nomEntiteAlias(alias)} : ${alias.reference}`),
  };
}

export function poolToExportRow(pool: LaboPoolRegistre, mesEntites: Array<string>): ExportRow {
  return {
    reference_pool: pool.reference_pool,
    ...aliasesExport(pool.Aliases, mesEntites),
    type: pool.type,
    reference_pool_parent: pool.PoolParent?.reference_pool ?? null,
    date_constitution: isoDate(pool.date_constitution),
    date_reception: isoDateTime(pool.date_reception),
    date_debut_analyse: isoDate(pool.date_debut_analyse),
    date_fin_analyse: isoDate(pool.date_fin_analyse),
    statut: pool.statut,
    resultat_analyse: pool.resultat_analyse,
    parasite_identifie: pool.parasite_identifie,
    raison_refus: pool.raison_refus,
    numeros_ftp: pool.TrichinePoolFTPs.map((link) => link.TrichineFTP.numero_fiche),
    nombre_echantillons: pool.TrichineEchantillons.length,
    references_echantillons: pool.TrichineEchantillons.map(
      (echantillon) => echantillon.reference_echantillon
    ),
    commentaire: pool.commentaire,
  };
}

export function echantillonToExportRow(
  echantillon: LaboEchantillonRegistre,
  mesEntites: Array<string>
): ExportRow {
  return {
    reference_echantillon: echantillon.reference_echantillon,
    ...aliasesExport(echantillon.Aliases, mesEntites),
    numero_bracelet: echantillon.Carcasse.numero_bracelet,
    espece: echantillon.Carcasse.espece,
    date_mise_a_mort: isoDate(echantillon.Carcasse.date_mise_a_mort),
    commune_mise_a_mort: echantillon.Carcasse.Fei.commune_mise_a_mort,
    type: echantillon.type,
    site_prelevement: echantillon.site_prelevement,
    masse_grammes: echantillon.masse_grammes,
    date_prelevement: isoDate(echantillon.date_prelevement),
    statut: echantillon.statut,
    resultat_analyse: echantillon.resultat_analyse,
    reference_pool: echantillon.TrichinePool?.reference_pool ?? null,
    commentaire: echantillon.commentaire,
  };
}

export function ftpToExportRow(ftp: LaboFTPListItem, mesEntites: Array<string>): ExportRow {
  return {
    numero_fiche: ftp.numero_fiche,
    ...aliasesExport(ftp.Aliases, mesEntites),
    direction: ftp.direction,
    expediteur_prenom: ftp.ExpediteurUser.prenom,
    expediteur_nom: ftp.ExpediteurUser.nom_de_famille,
    expediteur_email: ftp.ExpediteurUser.email,
    expediteur_telephone: ftp.ExpediteurUser.telephone,
    expediteur_entite: ftp.ExpediteurEntity?.nom_d_usage ?? ftp.ExpediteurEntity?.raison_sociale ?? null,
    destinataire_entite: ftp.DestinataireEntity.nom_d_usage ?? ftp.DestinataireEntity.raison_sociale,
    destinataire_is_lnr: ftp.DestinataireEntity.is_lnr,
    date_creation: isoDateTime(ftp.date_creation),
    date_envoi: isoDateTime(ftp.date_envoi),
    statut_logistique: ftp.statut_logistique,
    statut_analytique: ftp.statut_analytique,
    references_pools: ftp.TrichinePoolFTPs.map((link) => link.TrichinePool.reference_pool),
    mode_transport: ftp.mode_transport,
    date_annulation: isoDateTime(ftp.date_annulation),
    raison_annulation: ftp.raison_annulation,
    commentaire: ftp.commentaire,
  };
}

function csvCell(value: ExportValue): string {
  if (value === null) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<ExportRow>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))];
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadTrichineExport({
  rows,
  nom,
  format,
}: {
  rows: Array<ExportRow>;
  nom: string;
  format: TrichineExportFormat;
}) {
  const blob =
    format === 'csv'
      ? new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
      : new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zacharie-${nom}-${dayjs().format('YYYY-MM-DD-HHmm')}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
