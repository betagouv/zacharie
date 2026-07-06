import { describe, it, expect } from 'vitest';
import { UserRoles, CarcasseType, type User, type Carcasse, type Fei } from '@prisma/client';
import { searchLocally } from './search-local';

const feiNumero = 'ZACH-TEST-001';

function carcasse(overrides: Partial<Carcasse> = {}): Carcasse {
  return {
    zacharie_carcasse_id: `${feiNumero}_MM-001-001`,
    fei_numero: feiNumero,
    numero_bracelet: 'MM-001-001',
    espece: 'Daim',
    type: CarcasseType.GROS_GIBIER,
    svi_assigned_at: new Date('2026-05-10T09:00:00Z'),
    premier_detenteur_prochain_detenteur_id_cache: 'etg-1',
    deleted_at: null,
    intermediaire_carcasse_refus_intermediaire_id: null,
    intermediaire_carcasse_manquante: false,
    ...overrides,
  } as unknown as Carcasse;
}

function fei(overrides: Partial<Fei> = {}): Fei {
  return {
    numero: feiNumero,
    deleted_at: null,
    date_mise_a_mort: new Date('2026-05-01'),
    commune_mise_a_mort: '03510 CHASSENARD',
    ...overrides,
  } as unknown as Fei;
}

const chasseur = { id: 'u1', roles: [UserRoles.CHASSEUR] } as User;
const etg = { id: 'u2', roles: [UserRoles.ETG] } as User;

const byId = (...cs: Carcasse[]): Record<string, Carcasse> =>
  Object.fromEntries(cs.map((c) => [c.zacharie_carcasse_id, c]));
const feisById = (...fs: Fei[]): Record<string, Fei> => Object.fromEntries(fs.map((f) => [f.numero, f]));

describe('searchLocally', () => {
  it('empty query → ok:false with no data', () => {
    const res = searchLocally('   ', chasseur, byId(carcasse()), feisById(fei()), {});
    expect(res.ok).toBe(false);
    expect(res.data).toEqual([]);
  });

  it('bracelet match (chasseur) → carcasse result reads svi_assigned_at from the carcasse + fiche redirect', () => {
    const res = searchLocally('mm-001', chasseur, byId(carcasse()), feisById(fei()), {});
    expect(res.ok).toBe(true);
    expect(res.data).toHaveLength(1);
    const item = res.data[0];
    expect(item.carcasse_numero_bracelet).toBe('MM-001-001');
    expect(item.carcasse_svi_assigned_at).toEqual(new Date('2026-05-10T09:00:00Z'));
    expect(item.redirectUrl).toBe(`/app/chasseur/fei/${feiNumero}`);
  });

  it('bracelet match (ETG) → redirect targets the transmission (fiche + prochain détenteur) built from the carcasse', () => {
    const res = searchLocally('mm-001', etg, byId(carcasse()), feisById(fei()), {});
    expect(res.data[0].redirectUrl).toBe(`/app/etg/fei/${feiNumero}/etg-1`);
  });

  it('excludes deleted / refused / manquante carcasses from bracelet search', () => {
    const deleted = carcasse({
      zacharie_carcasse_id: 'x_del',
      numero_bracelet: 'MM-001-002',
      deleted_at: new Date(),
    });
    const refused = carcasse({
      zacharie_carcasse_id: 'x_ref',
      numero_bracelet: 'MM-001-003',
      intermediaire_carcasse_refus_intermediaire_id: 'refus-1',
    });
    const manquante = carcasse({
      zacharie_carcasse_id: 'x_manq',
      numero_bracelet: 'MM-001-004',
      intermediaire_carcasse_manquante: true,
    });
    const res = searchLocally('mm-001', chasseur, byId(deleted, refused, manquante), feisById(fei()), {});
    // aucune carcasse recherchable → on retombe sur la recherche par n° de fiche (pas de match ici)
    expect(res.data).toEqual([]);
  });

  it('fiche numero match (chasseur) → fiche result with fiche redirect', () => {
    const res = searchLocally('zach-test', chasseur, {}, feisById(fei()), {});
    expect(res.ok).toBe(true);
    expect(res.data).toHaveLength(1);
    expect(res.data[0].fei_numero).toBe(feiNumero);
    expect(res.data[0].redirectUrl).toBe(`/app/chasseur/fei/${feiNumero}`);
  });

  it('no match → ok:true with an explanatory error and empty data', () => {
    const res = searchLocally('zzzzz', chasseur, byId(carcasse()), feisById(fei()), {});
    expect(res.ok).toBe(true);
    expect(res.data).toEqual([]);
    expect(res.error).toMatch(/Aucun élément/);
  });
});
