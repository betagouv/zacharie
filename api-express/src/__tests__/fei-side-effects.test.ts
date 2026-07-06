import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import { sendWebhook } from '~/utils/api';
import { syncCarcasseDates, webhookApprobation } from '~/utils/fei-side-effects';

vi.mock('~/utils/api', () => ({ sendWebhook: vi.fn().mockResolvedValue(undefined) }));

const feiNumero = 'ZACH-TEST-001';

const makeFei = (overrides: any = {}) => ({
  numero: feiNumero,
  date_mise_a_mort: new Date('2026-05-01'),
  heure_mise_a_mort_premiere_carcasse: '08:00',
  heure_evisceration_derniere_carcasse: '09:00',
  examinateur_initial_user_id: 'exam-1',
  examinateur_initial_date_approbation_mise_sur_le_marche: new Date('2026-05-02T10:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// Les heures/dates de mise à mort vivent sur la Fei mais sont dupliquées sur chaque carcasse
// (champs `*_fei`). syncCarcasseDates propage un changement Fei vers toutes ses carcasses.
describe('syncCarcasseDates — propagates fei date/heure changes down to its carcasses', () => {
  test('no change → no carcasse update', async () => {
    // date_mise_a_mort est comparée par référence (Date) : on partage l'instance pour simuler "inchangé".
    const date = new Date('2026-05-01');
    const existing = makeFei({ date_mise_a_mort: date });
    const saved = makeFei({ date_mise_a_mort: date });
    await syncCarcasseDates(existing as any, saved as any);
    expect(prisma.carcasse.updateMany).not.toHaveBeenCalled();
  });

  test('date_mise_a_mort change → propagates the new date to every carcasse of the fiche', async () => {
    const existing = makeFei();
    const saved = makeFei({ date_mise_a_mort: new Date('2026-06-15') });
    await syncCarcasseDates(existing as any, saved as any);
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: feiNumero },
      data: { date_mise_a_mort: saved.date_mise_a_mort },
    });
  });

  test('heure_mise_a_mort_premiere_carcasse change → maps to carcasse.heure_mise_a_mort_premiere_carcasse_fei', async () => {
    const existing = makeFei();
    const saved = makeFei({ heure_mise_a_mort_premiere_carcasse: '07:30' });
    await syncCarcasseDates(existing as any, saved as any);
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: feiNumero },
      data: { heure_mise_a_mort_premiere_carcasse_fei: '07:30' },
    });
  });

  test('heure_evisceration_derniere_carcasse change → maps to carcasse.heure_evisceration_derniere_carcasse_fei', async () => {
    const existing = makeFei();
    const saved = makeFei({ heure_evisceration_derniere_carcasse: '10:15' });
    await syncCarcasseDates(existing as any, saved as any);
    expect(prisma.carcasse.updateMany).toHaveBeenCalledWith({
      where: { fei_numero: feiNumero },
      data: { heure_evisceration_derniere_carcasse_fei: '10:15' },
    });
  });

  test('only the changed field triggers an update (heure change → single updateMany)', async () => {
    const date = new Date('2026-05-01');
    const existing = makeFei({ date_mise_a_mort: date });
    const saved = makeFei({ date_mise_a_mort: date, heure_mise_a_mort_premiere_carcasse: '07:30' });
    await syncCarcasseDates(existing as any, saved as any);
    expect(prisma.carcasse.updateMany).toHaveBeenCalledTimes(1);
  });
});

describe('webhookApprobation', () => {
  test('approbation date changed → FEI_APPROBATION webhook to the examinateur', async () => {
    const existing = makeFei({ examinateur_initial_date_approbation_mise_sur_le_marche: null });
    const saved = makeFei();
    await webhookApprobation(existing as any, saved as any);
    expect(sendWebhook).toHaveBeenCalledWith('exam-1', 'FEI_APPROBATION_MISE_SUR_LE_MARCHE', { feiNumero });
  });

  test('approbation date unchanged → no webhook', async () => {
    const approbation = new Date('2026-05-02T10:00:00Z');
    const existing = makeFei({ examinateur_initial_date_approbation_mise_sur_le_marche: approbation });
    const saved = makeFei({ examinateur_initial_date_approbation_mise_sur_le_marche: approbation });
    await webhookApprobation(existing as any, saved as any);
    expect(sendWebhook).not.toHaveBeenCalled();
  });
});
