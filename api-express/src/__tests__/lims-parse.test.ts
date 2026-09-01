import { describe, it, expect } from 'vitest';
import { TrichineResultatAnalyse } from '@prisma/client';
import { DEFAULT_MAPPING } from '~/utils/lims-mapping';
import { detectFormat, mapRow, parseLimsFile } from '~/utils/lims-parse';

describe('detectFormat', () => {
  it('détecte par extension', () => {
    expect(detectFormat('whatever', 'export.xml')).toBe('xml');
    expect(detectFormat('whatever', 'export.csv')).toBe('csv');
  });
  it('détecte par contenu quand pas de nom fiable', () => {
    expect(detectFormat('<resultats></resultats>')).toBe('xml');
    expect(detectFormat('reference_pool;resultat_analyse')).toBe('csv');
  });
});

describe('parseLimsFile + mapRow — CSV', () => {
  const csv = [
    'reference_pool;resultat_analyse;parasite_identifie;date_debut_analyse;date_fin_analyse;reference_labo;commentaire',
    'P-26-000045;NEGATIF;;2026-07-01;2026-07-02;LAB-889;',
    'P-26-000046;négatif;;;;;',
    'P-26-000047;wat;;;;;',
  ].join('\n');

  it('parse toutes les lignes de données', () => {
    const rows = parseLimsFile(csv, 'export.csv', DEFAULT_MAPPING);
    expect(rows).toHaveLength(3);
  });

  it('mappe les champs canoniques', () => {
    const rows = parseLimsFile(csv, 'export.csv', DEFAULT_MAPPING).map((r) => mapRow(r, DEFAULT_MAPPING));
    expect(rows[0]).toMatchObject({
      reference_pool: 'P-26-000045',
      resultat_analyse: TrichineResultatAnalyse.NEGATIF,
      reference_labo: 'LAB-889',
      date_debut_analyse: '2026-07-01',
    });
  });

  it('normalise la valeur de résultat (casse + accents)', () => {
    const rows = parseLimsFile(csv, 'export.csv', DEFAULT_MAPPING).map((r) => mapRow(r, DEFAULT_MAPPING));
    expect(rows[1].resultat_analyse).toBe(TrichineResultatAnalyse.NEGATIF);
  });

  it('laisse resultat_analyse à null si le libellé est inconnu (→ ligne invalide)', () => {
    const rows = parseLimsFile(csv, 'export.csv', DEFAULT_MAPPING).map((r) => mapRow(r, DEFAULT_MAPPING));
    expect(rows[2].resultat_analyse).toBeNull();
    expect(rows[2].raw_resultat).toBe('wat');
  });

  it('accepte le séparateur virgule', () => {
    const commaCsv = 'reference_pool,resultat_analyse\nP-26-000050,POSITIF';
    const rows = parseLimsFile(commaCsv, 'x.csv', DEFAULT_MAPPING).map((r) => mapRow(r, DEFAULT_MAPPING));
    expect(rows[0]).toMatchObject({
      reference_pool: 'P-26-000050',
      resultat_analyse: TrichineResultatAnalyse.POSITIF,
    });
  });
});

describe('parseLimsFile + mapRow — XML', () => {
  const xml = `<resultats>
    <analyse reference_pool="P-26-000045" resultat_analyse="POSITIF" reference_labo="LAB-1"/>
    <analyse reference_pool="P-26-000046" resultat_analyse="DOUTEUX"/>
  </resultats>`;

  it('extrait les nœuds via rowSelector et mappe les attributs', () => {
    const rows = parseLimsFile(xml, 'export.xml', DEFAULT_MAPPING).map((r) => mapRow(r, DEFAULT_MAPPING));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      reference_pool: 'P-26-000045',
      resultat_analyse: TrichineResultatAnalyse.POSITIF,
      reference_labo: 'LAB-1',
    });
    expect(rows[1].resultat_analyse).toBe(TrichineResultatAnalyse.DOUTEUX);
  });

  it('gère un nœud unique (non-array)', () => {
    const single = `<resultats><analyse reference_pool="P-26-000099" resultat_analyse="NEGATIF"/></resultats>`;
    const rows = parseLimsFile(single, 'x.xml', DEFAULT_MAPPING).map((r) => mapRow(r, DEFAULT_MAPPING));
    expect(rows).toHaveLength(1);
    expect(rows[0].reference_pool).toBe('P-26-000099');
    expect(rows[0].resultat_analyse).toBe(TrichineResultatAnalyse.NEGATIF);
  });
});
