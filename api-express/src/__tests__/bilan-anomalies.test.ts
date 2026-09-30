import { describe, expect, it } from 'vitest';
import { CarcasseStatus, CarcasseType } from '@prisma/client';
import { buildBilanAnomalies, getSaisonBounds, type BilanCarcasse } from '~/utils/bilan-anomalies';

const etgs = [
  { id: 'etg-b', nom: 'ETG B', code_postal: '63000' },
  { id: 'etg-a', nom: 'ETG A', code_postal: '03200' },
];

function carcasse(overrides: Partial<BilanCarcasse>): BilanCarcasse {
  return {
    espece: 'Chevreuil',
    type: CarcasseType.GROS_GIBIER,
    nombre_d_animaux: 1,
    svi_assigned_at: new Date('2025-11-10'),
    svi_carcasse_status: CarcasseStatus.ACCEPTE,
    svi_ipm1_lesions_ou_motifs: [],
    svi_ipm1_nombre_animaux: null,
    svi_ipm2_lesions_ou_motifs: [],
    svi_ipm2_nombre_animaux: null,
    examinateur_anomalies_carcasse: [],
    examinateur_anomalies_abats: [],
    etg_id: 'etg-a',
    ...overrides,
  };
}

describe('buildBilanAnomalies', () => {
  it('produit une ligne par ETG et groupe d’espèces, triée par ETG', () => {
    const lignes = buildBilanAnomalies(
      [carcasse({ etg_id: 'etg-b' }), carcasse({ espece: 'Cerf sika' })],
      etgs
    );
    expect(lignes).toHaveLength(14);
    expect(lignes[0]).toMatchObject({ etg_nom: 'ETG A', etg_departement: '03', groupe_espece: 'Cerf' });
    expect(lignes[0].receptionnees).toBe(1);
    expect(lignes[7]).toMatchObject({ etg_nom: 'ETG B', groupe_espece: 'Cerf', receptionnees: 0 });
    expect(lignes[8]).toMatchObject({ etg_nom: 'ETG B', groupe_espece: 'Chevreuil', receptionnees: 1 });
  });

  it('compte les carcasses contrôlées et les saisies', () => {
    const [ligne] = buildBilanAnomalies(
      [
        carcasse({ espece: 'Sanglier' }),
        carcasse({ espece: 'Sanglier', svi_carcasse_status: CarcasseStatus.SANS_DECISION }),
        carcasse({ espece: 'Sanglier', svi_assigned_at: null, svi_carcasse_status: null }),
        carcasse({ espece: 'Sanglier', svi_carcasse_status: CarcasseStatus.MANQUANTE_SVI }),
        carcasse({
          espece: 'Sanglier',
          svi_carcasse_status: CarcasseStatus.SAISIE_TOTALE,
          examinateur_anomalies_carcasse: ['Abcès'],
        }),
        carcasse({ espece: 'Sanglier', svi_carcasse_status: CarcasseStatus.SAISIE_PARTIELLE }),
      ],
      etgs
    ).filter((l) => l.groupe_espece === 'Sanglier');
    expect(ligne).toMatchObject({
      receptionnees: 6,
      controlees: 3,
      saisies_totales: 1,
      saisies_partielles: 1,
      saisies_non_signalees_fei: 1,
    });
  });

  it('compte les animaux d’un lot de petit gibier', () => {
    const [ligne] = buildBilanAnomalies(
      [
        carcasse({
          espece: 'Lièvres',
          type: CarcasseType.PETIT_GIBIER,
          nombre_d_animaux: 10,
          svi_carcasse_status: CarcasseStatus.SAISIE_TOTALE,
          svi_ipm2_nombre_animaux: 3,
          svi_ipm2_lesions_ou_motifs: ['Moisissures'],
        }),
      ],
      etgs
    ).filter((l) => l.groupe_espece === 'Petit gibier à poils');
    expect(ligne).toMatchObject({ receptionnees: 10, controlees: 10, saisies_totales: 3 });
    expect(ligne.anomalies['Moisissures']).toBe(3);
  });

  it('répartit les motifs SVI entre colonnes du calque, examen initial et autres motifs', () => {
    const [ligne] = buildBilanAnomalies(
      [
        carcasse({
          svi_carcasse_status: CarcasseStatus.SAISIE_TOTALE,
          svi_ipm1_lesions_ou_motifs: ['Putréfaction profonde'],
          svi_ipm2_lesions_ou_motifs: [
            'Putréfaction profonde',
            'Ictère',
            'Couleur anormale',
            "Viandes provenant d'une carcasse dont l'examen initial n'est pas valide",
            'Fracture',
          ],
        }),
      ],
      etgs
    ).filter((l) => l.groupe_espece === 'Chevreuil');
    expect(ligne.anomalies['Putréfaction profonde']).toBe(1);
    expect(ligne.anomalies['Anomalies de couleur ou de consistance']).toBe(1);
    expect(ligne.ei_non_valide).toBe(1);
    expect(ligne.saisies_totales_ei).toBe(1);
    expect(ligne.autres_motifs).toEqual({ Fracture: 1 });
    expect(ligne.anomalies['Douchage des venaisons']).toBeUndefined();
  });
});

describe('getSaisonBounds', () => {
  it('va du 1er juin au 1er juin suivant', () => {
    const { start, end } = getSaisonBounds(2025);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(5);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(5);
  });
});
