import { describe, test, expect, vi, beforeEach } from 'vitest';
import { EntityRelationStatus, EntityRelationType } from '@prisma/client';
import prisma from '~/prisma';
import { requestCarcassesReloadIfAccessChanged } from '~/utils/carcasses-reload';

// Un changement d'appartenance à une entité (périmètre carcasses) pose
// User.carcasses_reload_requested_at : tous les appareils de l'utilisateur rechargent leur périmètre.

const HANDLE = EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY;
const TRANSMIT = EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY;
const { ADMIN, MEMBER, REQUESTED } = EntityRelationStatus;

const rel = (status: EntityRelationStatus, relation: EntityRelationType = HANDLE, owner_id = 'user-1') => ({
  owner_id,
  relation,
  status,
});

function reloadedUserIds() {
  return vi.mocked(prisma.user.update).mock.calls.map((call) => call[0].where.id);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requestCarcassesReloadIfAccessChanged', () => {
  test.each([
    ['rejoint une entité comme membre', null, rel(MEMBER), ['user-1']],
    ['rejoint une entité comme admin', null, rel(ADMIN), ['user-1']],
    ['demande validée (REQUESTED → MEMBER)', rel(REQUESTED), rel(MEMBER), ['user-1']],
    ['quitte une entité', rel(MEMBER), null, ['user-1']],
    ['rétrogradé en demande (MEMBER → REQUESTED)', rel(MEMBER), rel(REQUESTED), ['user-1']],
    ['demande simple (pas encore membre)', null, rel(REQUESTED), []],
    ['demande refusée', rel(REQUESTED), null, []],
    ['MEMBER → ADMIN : même périmètre', rel(MEMBER), rel(ADMIN), []],
    ['relation partenaire (CAN_TRANSMIT)', null, rel(ADMIN, TRANSMIT), []],
    ['suppression d’une relation partenaire', rel(ADMIN, TRANSMIT), null, []],
  ])('%s', async (_label, before, after, expected) => {
    await requestCarcassesReloadIfAccessChanged(before, after);
    expect(reloadedUserIds()).toEqual(expected);
    for (const call of vi.mocked(prisma.user.update).mock.calls) {
      expect(call[0].data.carcasses_reload_requested_at).toBeInstanceOf(Date);
    }
  });
});
