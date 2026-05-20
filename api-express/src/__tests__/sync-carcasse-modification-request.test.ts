import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  syncCarcasseModifRequest,
  runCarcasseModifRequestSideEffects,
} from '~/utils/sync-carcasse-modification-request';
import prisma from '~/prisma';
import {
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
  UserRoles,
  type CarcasseModificationRequest,
  type User,
} from '@prisma/client';

vi.mock('~/service/notifications', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/third-parties/sentry', () => ({
  capture: vi.fn(),
}));

import sendNotificationToUser from '~/service/notifications';

const examinateur = {
  id: 'user-examinateur',
  roles: [UserRoles.CHASSEUR],
  activated: true,
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
} as unknown as User;

const requester = {
  id: 'user-requester',
  roles: [UserRoles.ETG],
  activated: true,
  prenom: 'Alice',
  nom_de_famille: 'Martin',
} as unknown as User;

const stranger = {
  id: 'user-stranger',
  roles: [UserRoles.ETG],
  activated: true,
} as unknown as User;

const baseCarcasse = {
  zacharie_carcasse_id: 'ZC-1',
  fei_numero: 'FEI-1',
  numero_bracelet: 'BR-OLD',
  examinateur_initial_user_id: examinateur.id,
  deleted_at: null,
  espece: 'Cerf élaphe',
  Fei: {
    numero: 'FEI-1',
    date_mise_a_mort: new Date('2026-04-22'),
    commune_mise_a_mort: 'Villette',
    FeiExaminateurInitialUser: examinateur,
  },
} as any;

const renamePending = {
  id: 'mod-1',
  type: CarcasseModificationRequestType.BRACELET_RENAME,
  status: CarcasseModificationRequestStatus.PENDING,
  zacharie_carcasse_id: 'ZC-1',
  fei_numero: 'FEI-1',
  requested_by_user_id: requester.id,
  requested_by_entity_id: 'entity-etg',
  requested_at: new Date('2026-04-22T10:00:00Z'),
  numero_bracelet_before: 'BR-OLD',
  numero_bracelet_after: 'BR-NEW',
  reviewed_by_user_id: null,
  reviewed_at: null,
  rejection_reason: null,
  comment_intermediaire: null,
  deleted_at: null,
  is_synced: true,
  created_at: new Date('2026-04-22T10:00:00Z'),
  updated_at: new Date('2026-04-22T10:00:00Z'),
} as unknown as CarcasseModificationRequest;

const newPending = {
  ...renamePending,
  id: 'mod-2',
  type: CarcasseModificationRequestType.NEW_CARCASSE,
  numero_bracelet_before: null,
  numero_bracelet_after: null,
} as unknown as CarcasseModificationRequest;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// syncCarcasseModifRequest
// ---------------------------------------------------------------------------

describe('syncCarcasseModifRequest — validation', () => {
  test('missing id → throws', async () => {
    await expect(syncCarcasseModifRequest({} as any, examinateur)).rejects.toThrow('id manquant');
  });

  test('missing zacharie_carcasse_id → throws', async () => {
    await expect(syncCarcasseModifRequest({ id: 'mod-x' } as any, examinateur)).rejects.toThrow(
      'zacharie_carcasse_id manquant'
    );
  });
});

describe('syncCarcasseModifRequest — create', () => {
  test('creates a new modif request with is_synced: true', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.carcasseModificationRequest.create).mockResolvedValueOnce(renamePending);

    const result = await syncCarcasseModifRequest({ ...renamePending } as any, requester);

    expect(prisma.carcasseModificationRequest.create).toHaveBeenCalledOnce();
    const createArgs = vi.mocked(prisma.carcasseModificationRequest.create).mock.calls[0][0];
    expect(createArgs.data).toMatchObject({ id: 'mod-1', is_synced: true });

    expect(result.isNew).toBe(true);
    expect(result.transitionedTo).toBeNull();
    expect(result.justCancelled).toBe(false);
  });
});

describe('syncCarcasseModifRequest — approval', () => {
  test('examinateur approving PENDING → transitionedTo APPROVED, row updated', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(renamePending);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasseModificationRequest.update).mockResolvedValueOnce({
      ...renamePending,
      status: CarcasseModificationRequestStatus.APPROVED,
    } as any);

    const result = await syncCarcasseModifRequest(
      {
        ...renamePending,
        status: CarcasseModificationRequestStatus.APPROVED,
        reviewed_by_user_id: examinateur.id,
        reviewed_at: new Date(),
      } as any,
      examinateur
    );

    expect(result.transitionedTo).toBe(CarcasseModificationRequestStatus.APPROVED);
    expect(result.isNew).toBe(false);
    expect(prisma.carcasseModificationRequest.update).toHaveBeenCalledOnce();
  });

  test('non-examinateur approving → throws, row NOT updated', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(renamePending);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);

    await expect(
      syncCarcasseModifRequest(
        {
          ...renamePending,
          status: CarcasseModificationRequestStatus.APPROVED,
          reviewed_by_user_id: stranger.id,
        } as any,
        stranger
      )
    ).rejects.toThrow(/examinateur initial/i);

    expect(prisma.carcasseModificationRequest.update).not.toHaveBeenCalled();
  });

  test('carcasse not found during approval check → throws', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(renamePending);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(null);

    await expect(
      syncCarcasseModifRequest(
        { ...renamePending, status: CarcasseModificationRequestStatus.APPROVED } as any,
        examinateur
      )
    ).rejects.toThrow('Carcasse introuvable');
  });
});

describe('syncCarcasseModifRequest — rejection', () => {
  test('examinateur rejecting PENDING → transitionedTo REJECTED', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(renamePending);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.carcasseModificationRequest.update).mockResolvedValueOnce({
      ...renamePending,
      status: CarcasseModificationRequestStatus.REJECTED,
    } as any);

    const result = await syncCarcasseModifRequest(
      {
        ...renamePending,
        status: CarcasseModificationRequestStatus.REJECTED,
        reviewed_by_user_id: examinateur.id,
        reviewed_at: new Date(),
        rejection_reason: 'pas le bon numéro',
      } as any,
      examinateur
    );

    expect(result.transitionedTo).toBe(CarcasseModificationRequestStatus.REJECTED);
  });

  test('non-examinateur rejecting → throws', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(renamePending);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);

    await expect(
      syncCarcasseModifRequest(
        { ...renamePending, status: CarcasseModificationRequestStatus.REJECTED } as any,
        stranger
      )
    ).rejects.toThrow(/examinateur initial/i);
  });
});

describe('syncCarcasseModifRequest — cancellation', () => {
  test('requester cancels their own PENDING → justCancelled: true', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(renamePending);
    vi.mocked(prisma.carcasseModificationRequest.update).mockResolvedValueOnce({
      ...renamePending,
      deleted_at: new Date(),
    } as any);

    const result = await syncCarcasseModifRequest(
      { ...renamePending, deleted_at: new Date() } as any,
      requester
    );

    expect(result.justCancelled).toBe(true);
    expect(result.transitionedTo).toBeNull();
  });

  test('non-requester trying to cancel → throws', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce(renamePending);

    await expect(
      syncCarcasseModifRequest({ ...renamePending, deleted_at: new Date() } as any, stranger)
    ).rejects.toThrow(/auteur de la demande/i);

    expect(prisma.carcasseModificationRequest.update).not.toHaveBeenCalled();
  });

  test('cancellation of an already-resolved request → not flagged as justCancelled', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce({
      ...renamePending,
      status: CarcasseModificationRequestStatus.APPROVED,
    } as any);
    vi.mocked(prisma.carcasseModificationRequest.update).mockResolvedValueOnce({} as any);

    const result = await syncCarcasseModifRequest(
      {
        ...renamePending,
        status: CarcasseModificationRequestStatus.APPROVED,
        deleted_at: new Date(),
      } as any,
      requester
    );

    expect(result.justCancelled).toBe(false);
  });
});

describe('syncCarcasseModifRequest — idempotence', () => {
  test('re-syncing already-APPROVED row → no transition flagged', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce({
      ...renamePending,
      status: CarcasseModificationRequestStatus.APPROVED,
    } as any);
    vi.mocked(prisma.carcasseModificationRequest.update).mockResolvedValueOnce({} as any);

    const result = await syncCarcasseModifRequest(
      { ...renamePending, status: CarcasseModificationRequestStatus.APPROVED } as any,
      examinateur
    );

    expect(result.transitionedTo).toBeNull();
    // No carcasse lookup needed because there's no PENDING→non-PENDING transition.
    expect(prisma.carcasse.findUnique).not.toHaveBeenCalled();
  });

  test('status going from APPROVED back to PENDING (illegal regression) is not a willTransition', async () => {
    vi.mocked(prisma.carcasseModificationRequest.findUnique).mockResolvedValueOnce({
      ...renamePending,
      status: CarcasseModificationRequestStatus.APPROVED,
    } as any);
    vi.mocked(prisma.carcasseModificationRequest.update).mockResolvedValueOnce({} as any);

    const result = await syncCarcasseModifRequest(
      { ...renamePending, status: CarcasseModificationRequestStatus.PENDING } as any,
      examinateur
    );

    // willTransition requires existing.status === PENDING; here existing is APPROVED → not a transition.
    expect(result.transitionedTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// runCarcasseModifRequestSideEffects
// ---------------------------------------------------------------------------

describe('runCarcasseModifRequestSideEffects — create', () => {
  test('isNew → notifies examinateur, no carcasse mutation', async () => {
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.entity.findUnique).mockResolvedValueOnce({
      id: 'entity-etg',
      nom_d_usage: 'ETG de la Garenne',
    } as any);

    await runCarcasseModifRequestSideEffects({
      saved: renamePending,
      isNew: true,
      transitionedTo: null,
      justCancelled: false,
    });

    expect(sendNotificationToUser).toHaveBeenCalledOnce();
    expect(prisma.carcasse.update).not.toHaveBeenCalled();
  });
});

describe('runCarcasseModifRequestSideEffects — approval', () => {
  test('RENAME approved → updates numero_bracelet, notifies requester', async () => {
    vi.mocked(prisma.carcasse.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(requester);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);

    await runCarcasseModifRequestSideEffects({
      saved: { ...renamePending, status: CarcasseModificationRequestStatus.APPROVED } as any,
      isNew: false,
      transitionedTo: CarcasseModificationRequestStatus.APPROVED,
      justCancelled: false,
    });

    expect(prisma.carcasse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { zacharie_carcasse_id: 'ZC-1' },
        data: { numero_bracelet: 'BR-NEW' },
      })
    );
    expect(sendNotificationToUser).toHaveBeenCalledOnce();
  });

  test('NEW approved with payload → fills examinateur fields + signed_at', async () => {
    vi.mocked(prisma.carcasse.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(requester);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);

    await runCarcasseModifRequestSideEffects(
      {
        saved: { ...newPending, status: CarcasseModificationRequestStatus.APPROVED } as any,
        isNew: false,
        transitionedTo: CarcasseModificationRequestStatus.APPROVED,
        justCancelled: false,
      },
      {
        examinateur_anomalies_carcasse: ['hématome'],
        examinateur_anomalies_abats: [],
        examinateur_commentaire: 'ok',
        examinateur_carcasse_sans_anomalie: false,
        examinateur_approbation_mise_sur_le_marche: true,
      }
    );

    const call = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(call.data).toMatchObject({
      examinateur_anomalies_carcasse: ['hématome'],
      examinateur_anomalies_abats: [],
      examinateur_commentaire: 'ok',
      examinateur_carcasse_sans_anomalie: false,
    });
    expect(call.data.examinateur_signed_at).toBeInstanceOf(Date);
  });
});

describe('runCarcasseModifRequestSideEffects — rejection', () => {
  test('NEW rejected → soft-deletes carcasse', async () => {
    vi.mocked(prisma.carcasse.update).mockResolvedValue({} as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(requester);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);

    await runCarcasseModifRequestSideEffects({
      saved: { ...newPending, status: CarcasseModificationRequestStatus.REJECTED } as any,
      isNew: false,
      transitionedTo: CarcasseModificationRequestStatus.REJECTED,
      justCancelled: false,
    });

    const call = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(call.where).toEqual({ zacharie_carcasse_id: 'ZC-1' });
    expect(call.data.deleted_at).toBeInstanceOf(Date);
  });

  test('RENAME rejected → no carcasse mutation, just notify', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(requester);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);

    await runCarcasseModifRequestSideEffects({
      saved: { ...renamePending, status: CarcasseModificationRequestStatus.REJECTED } as any,
      isNew: false,
      transitionedTo: CarcasseModificationRequestStatus.REJECTED,
      justCancelled: false,
    });

    expect(prisma.carcasse.update).not.toHaveBeenCalled();
    expect(sendNotificationToUser).toHaveBeenCalledOnce();
  });
});

describe('runCarcasseModifRequestSideEffects — cancellation', () => {
  test('NEW cancelled → soft-deletes carcasse, no requester notification', async () => {
    vi.mocked(prisma.carcasse.update).mockResolvedValue({} as any);

    await runCarcasseModifRequestSideEffects({
      saved: newPending,
      isNew: false,
      transitionedTo: null,
      justCancelled: true,
    });

    const call = vi.mocked(prisma.carcasse.update).mock.calls[0][0];
    expect(call.data.deleted_at).toBeInstanceOf(Date);
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });

  test('RENAME cancelled → no mutation, no notification', async () => {
    await runCarcasseModifRequestSideEffects({
      saved: renamePending,
      isNew: false,
      transitionedTo: null,
      justCancelled: true,
    });

    expect(prisma.carcasse.update).not.toHaveBeenCalled();
    expect(sendNotificationToUser).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Notification content
// ---------------------------------------------------------------------------

describe('notification content', () => {
  test('notifyExaminateur uses "Chasse du DD/MM" title + entity name + bracelet swap', async () => {
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);
    vi.mocked(prisma.entity.findUnique).mockResolvedValueOnce({
      id: 'entity-etg',
      nom_d_usage: 'ETG de la Garenne',
    } as any);

    await runCarcasseModifRequestSideEffects({
      saved: renamePending,
      isNew: true,
      transitionedTo: null,
      justCancelled: false,
    });

    const call = vi.mocked(sendNotificationToUser).mock.calls[0][0];
    expect(call.title).toMatch(/^Chasse du \d{2}\/\d{2}$/);
    expect(call.body).toContain('ETG de la Garenne');
    expect(call.body).toContain('BR-NEW');
    expect(call.body).toContain('BR-OLD');
    expect(call.body).toContain('https://zacharie.beta.gouv.fr/app/chasseur/demandes-de-modification');
    expect(call.notificationLogAction).toBe(`MODIF_CREATED_${renamePending.id}`);
  });

  test('notifyExaminateur for NEW mentions espèce + bracelet', async () => {
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce({
      ...baseCarcasse,
      espece: 'Sanglier',
      numero_bracelet: 'BR-NEW-LOT',
    });
    vi.mocked(prisma.entity.findUnique).mockResolvedValueOnce({
      id: 'entity-etg',
      nom_d_usage: 'Collecteur Pro',
    } as any);

    await runCarcasseModifRequestSideEffects({
      saved: newPending,
      isNew: true,
      transitionedTo: null,
      justCancelled: false,
    });

    const call = vi.mocked(sendNotificationToUser).mock.calls[0][0];
    expect(call.body).toContain('Sanglier');
    expect(call.body).toContain('BR-NEW-LOT');
    expect(call.body).toContain('Collecteur Pro');
  });

  test('notifyRequester title = "Carcasse numéro X", body mentions examinateur + date + commune', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(requester);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);

    await runCarcasseModifRequestSideEffects({
      saved: { ...renamePending, status: CarcasseModificationRequestStatus.APPROVED } as any,
      isNew: false,
      transitionedTo: CarcasseModificationRequestStatus.APPROVED,
      justCancelled: false,
    });

    const call = vi.mocked(sendNotificationToUser).mock.calls.find((c) => c[0].user.id === requester.id)?.[0];
    expect(call).toBeDefined();
    expect(call!.title).toMatch(/^Carcasse numéro /);
    expect(call!.body).toContain('Jean Dupont');
    expect(call!.body).toContain('Villette');
    expect(call!.body).toMatch(/approuvé/);
  });

  test('notifyRequester for rejection says "refusé"', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(requester);
    vi.mocked(prisma.carcasse.findUnique).mockResolvedValueOnce(baseCarcasse);

    await runCarcasseModifRequestSideEffects({
      saved: { ...renamePending, status: CarcasseModificationRequestStatus.REJECTED } as any,
      isNew: false,
      transitionedTo: CarcasseModificationRequestStatus.REJECTED,
      justCancelled: false,
    });

    const call = vi.mocked(sendNotificationToUser).mock.calls.find((c) => c[0].user.id === requester.id)?.[0];
    expect(call!.body).toMatch(/refusé/);
  });
});
