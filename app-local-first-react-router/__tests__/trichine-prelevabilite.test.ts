import { describe, test, expect } from 'vitest';
import { TrichineResultatAnalyse } from '@prisma/client';
import { estPrelevable, etatsTrichineParCarcasse } from '@app/utils/trichine-prelevabilite';

// Un prélèvement n'a de sens que pour ouvrir une analyse : soit la carcasse n'a jamais été
// prélevée, soit son analyse a été déclarée impossible, soit elle est dans un pool douteux
// qu'aucune 2e intention ne couvre encore (cf doc/trichine.md §5.1).

const echantillon = (carcasseId: string) => ({ zacharie_carcasse_id: carcasseId, deleted_at: null });

const pool = ({
  id,
  carcasses,
  resultat = null,
  parent = null,
  jour = '2026-01-01',
  ftp = null,
}: {
  id: string;
  carcasses: Array<string>;
  resultat?: TrichineResultatAnalyse | null;
  parent?: string | null;
  jour?: string;
  ftp?: string | null;
}) => ({
  id,
  reference_pool: `P-${id}`,
  pool_parent_id: parent,
  resultat_analyse: resultat,
  created_at: new Date(jour),
  deleted_at: null,
  TrichineEchantillons: carcasses.map(echantillon),
  TrichinePoolFTPs: ftp ? [{ TrichineFTP: { numero_fiche: ftp, deleted_at: null } }] : [],
});

describe('etatsTrichineParCarcasse', () => {
  test('carcasse jamais prélevée : absente de la table, donc prélevable en initial', () => {
    const etats = etatsTrichineParCarcasse([], []);
    expect(etats.get('c-1')).toBeUndefined();
    expect(estPrelevable(etats.get('c-1'), null)).toBe(true);
  });

  test('analyse en cours : bloquée', () => {
    const etats = etatsTrichineParCarcasse(
      [echantillon('c-1')],
      [pool({ id: 'p1', carcasses: ['c-1'], ftp: 'F-26-000001' })]
    );
    expect(etats.get('c-1')).toMatchObject({ etat: 'BLOQUEE', pool: 'P-p1', ftps: ['F-26-000001'] });
    expect(estPrelevable(etats.get('c-1'), null)).toBe(false);
  });

  test('échantillon pas encore regroupé : bloqué, sans pool', () => {
    const etats = etatsTrichineParCarcasse([echantillon('c-1')], []);
    expect(etats.get('c-1')).toMatchObject({ etat: 'BLOQUEE', pool: null });
  });

  test('résultat négatif : bloquée', () => {
    const etats = etatsTrichineParCarcasse(
      [echantillon('c-1')],
      [pool({ id: 'p1', carcasses: ['c-1'], resultat: TrichineResultatAnalyse.NEGATIF })]
    );
    expect(etats.get('c-1')?.etat).toBe('BLOQUEE');
  });

  test('analyse impossible : on reprend un prélèvement initial', () => {
    const etats = etatsTrichineParCarcasse(
      [echantillon('c-1')],
      [pool({ id: 'p1', carcasses: ['c-1'], resultat: TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE })]
    );
    expect(etats.get('c-1')?.etat).toBe('INITIAL_A_REFAIRE');
    expect(estPrelevable(etats.get('c-1'), null)).toBe(true);
  });

  test('pool douteux : 2e intention sur ce pool, pas un prélèvement initial', () => {
    const mere = pool({
      id: 'p1',
      carcasses: ['c-1', 'c-2'],
      resultat: TrichineResultatAnalyse.DOUTEUX,
    });
    const etats = etatsTrichineParCarcasse([echantillon('c-1'), echantillon('c-2')], [mere]);
    expect(etats.get('c-1')).toMatchObject({
      etat: 'DEUXIEME_INTENTION',
      poolDouteux: { id: 'p1', reference_pool: 'P-p1' },
    });
    expect(estPrelevable(etats.get('c-1'), null)).toBe(false);
    expect(estPrelevable(etats.get('c-1'), 'p1')).toBe(true);
    expect(estPrelevable(etats.get('c-1'), 'un-autre-pool')).toBe(false);
  });

  test('carcasse déjà couverte par une fille : plus rien à reprélever', () => {
    const etats = etatsTrichineParCarcasse(
      [echantillon('c-1'), echantillon('c-2')],
      [
        pool({ id: 'p1', carcasses: ['c-1', 'c-2'], resultat: TrichineResultatAnalyse.DOUTEUX }),
        pool({ id: 'p2', carcasses: ['c-1'], parent: 'p1', jour: '2026-02-01' }),
      ]
    );
    expect(etats.get('c-1')?.etat).toBe('BLOQUEE');
    // la carcasse restée hors de la fille attend toujours sa 2e intention
    expect(etats.get('c-2')?.etat).toBe('DEUXIEME_INTENTION');
  });

  test('fille douteuse à son tour : c’est elle qu’on resserre en petite-fille', () => {
    const etats = etatsTrichineParCarcasse(
      [echantillon('c-1')],
      [
        pool({ id: 'p1', carcasses: ['c-1'], resultat: TrichineResultatAnalyse.DOUTEUX }),
        pool({
          id: 'p2',
          carcasses: ['c-1'],
          parent: 'p1',
          resultat: TrichineResultatAnalyse.DOUTEUX,
          jour: '2026-02-01',
        }),
      ]
    );
    expect(etats.get('c-1')?.poolDouteux?.id).toBe('p2');
    expect(estPrelevable(etats.get('c-1'), 'p1')).toBe(false);
    expect(estPrelevable(etats.get('c-1'), 'p2')).toBe(true);
  });

  test('pool supprimé : ignoré', () => {
    const supprime = { ...pool({ id: 'p1', carcasses: ['c-1'] }), deleted_at: new Date('2026-01-02') };
    const etats = etatsTrichineParCarcasse([echantillon('c-1')], [supprime]);
    expect(etats.get('c-1')).toMatchObject({ etat: 'BLOQUEE', pool: null });
  });
});
