import { describe, it, expect } from 'vitest';
import { TrichineResultatAnalyse } from '@prisma/client';
import { ImportFormatError, mapRow, parseLimsFile } from '~/utils/lims-parse';
import { describePoolResultActions } from '~/utils/trichine-result';

const lireLvd = (raw: Record<string, string>) => mapRow(raw, false);
const lireLnr = (raw: Record<string, string>) => mapRow(raw, true);

describe('parseLimsFile + mapRow', () => {
  const csv = [
    'reference_pool;resultat_analyse;parasite_identifie;date_debut_analyse;date_fin_analyse;reference_labo;commentaire',
    'P-26-02-0045;NEGATIF;;2026-07-01;2026-07-02;LAB-889;',
    'P-26-02-0046;négatif;;;;;',
    'P-26-02-0047;wat;;;;;',
  ].join('\n');

  it('parse toutes les lignes de données', () => {
    expect(parseLimsFile(csv)).toHaveLength(3);
  });

  it('lit les colonnes du format', () => {
    const rows = parseLimsFile(csv).map(lireLvd);
    expect(rows[0]).toMatchObject({
      reference_pool: 'P-26-02-0045',
      resultat_analyse: TrichineResultatAnalyse.NEGATIF,
      reference_labo: 'LAB-889',
      date_debut_analyse: '2026-07-01',
    });
    expect(rows[0].erreur_format).toBeUndefined();
  });

  it('normalise la valeur de résultat (casse + accents)', () => {
    expect(parseLimsFile(csv).map(lireLvd)[1].resultat_analyse).toBe(TrichineResultatAnalyse.NEGATIF);
  });

  it('laisse resultat_analyse à null si la valeur est inconnue (→ ligne invalide)', () => {
    const rows = parseLimsFile(csv).map(lireLvd);
    expect(rows[2].resultat_analyse).toBeNull();
    expect(rows[2].raw_resultat).toBe('wat');
  });

  it('accepte le séparateur virgule', () => {
    const rows = parseLimsFile('reference_pool,resultat_analyse\nP-26-02-0050,POSITIF').map(lireLnr);
    expect(rows[0]).toMatchObject({
      reference_pool: 'P-26-02-0050',
      resultat_analyse: TrichineResultatAnalyse.POSITIF,
    });
  });

  it('ignore les colonnes inconnues et la casse des en-têtes', () => {
    const rows = parseLimsFile('Reference_Pool;RESULTAT_ANALYSE;colonne_lims\nP-26-02-0051;negatif;x').map(
      lireLvd
    );
    expect(rows[0]).toMatchObject({
      reference_pool: 'P-26-02-0051',
      resultat_analyse: TrichineResultatAnalyse.NEGATIF,
    });
  });

  it('non_negatif : à confirmer par le LNR pour un LVD, autre parasite pour le LNR', () => {
    const raw = { reference_pool: 'P-1', resultat_analyse: 'Non_Négatif' };
    expect(lireLvd(raw).resultat_analyse).toBe(TrichineResultatAnalyse.DOUTEUX);
    expect(lireLnr(raw).resultat_analyse).toBe(TrichineResultatAnalyse.NON_NEGATIF);
  });

  it('ne reconnaît que les valeurs du type de laboratoire', () => {
    expect(lireLvd({ reference_pool: 'P-1', resultat_analyse: 'positif' }).resultat_analyse).toBeNull();
    expect(lireLvd({ reference_pool: 'P-1', resultat_analyse: 'douteux' }).resultat_analyse).toBeNull();
    expect(lireLnr({ reference_pool: 'P-1', resultat_analyse: 'negatif' }).resultat_analyse).toBeNull();
  });

  it('refuse un fichier sans colonne obligatoire', () => {
    expect(() => parseLimsFile('reference_pool;resultat\nP-26-02-0052;negatif')).toThrow(ImportFormatError);
    expect(() => parseLimsFile('reference_pool;resultat\nP-26-02-0052;negatif')).toThrow(/resultat_analyse/);
  });

  it('signale une date qui ne suit pas le format AAAA-MM-JJ', () => {
    const rows = parseLimsFile(
      'reference_pool;resultat_analyse;date_fin_analyse\nP-1;negatif;02/07/2026\nP-2;negatif;2026-02-30'
    ).map(lireLvd);
    expect(rows[0].erreur_format).toMatch(/date_fin_analyse/);
    expect(rows[1].erreur_format).toMatch(/date_fin_analyse/);
  });
});

describe('describePoolResultActions', () => {
  const base = { reference_pool: 'P-26-02-0045', nbCarcasses: 3, ftpNumero: 'F-26-02-0012' };

  it('négatif : carcasses libérées + émetteur prévenu', () => {
    const { effet, actions } = describePoolResultActions({ ...base, resultat_analyse: 'NEGATIF' });
    expect(effet).toBe('liberees');
    expect(actions[0]).toMatch(/3 carcasses libérée/);
    expect(actions.some((action) => action.includes('F-26-02-0012'))).toBe(true);
  });

  it('douteux : fiche de confirmation vers le LNR', () => {
    const { effet, actions } = describePoolResultActions({ ...base, resultat_analyse: 'DOUTEUX' });
    expect(effet).toBe('en_attente_confirmation');
    expect(actions.some((action) => action.includes('LNR est créée'))).toBe(true);
  });

  it('positif : carcasses à saisir', () => {
    const { effet } = describePoolResultActions({ ...base, resultat_analyse: 'POSITIF' });
    expect(effet).toBe('a_saisir');
  });

  it('mentionne la référence interne quand elle est posée', () => {
    const { actions } = describePoolResultActions({
      ...base,
      resultat_analyse: 'NEGATIF',
      referenceLabo: 'LAB-1',
    });
    expect(actions.at(-1)).toMatch(/LAB-1/);
  });
});
