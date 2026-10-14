import 'fake-indexeddb/auto';
import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest';
import { FeiOwnerRole, UserRoles, CarcasseType } from '@prisma/client';

import { createNewCarcasse } from '../src/utils/create-new-carcasse';
import useUser from '../src/zustand/user';
import useZustandStore from '../src/zustand/store';
import type { Carcasse, Fei } from '@prisma/client';

vi.mock('@app/services/sentry', () => ({ capture: vi.fn() }));

const examinateurUser = {
  id: 'EXAM-USER-1',
  prenom: 'Marie',
  nom_de_famille: 'Martin',
  email: 'examinateur@example.fr',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-075-25-001',
  est_forme_a_l_examen_initial: true,
} as unknown as ReturnType<typeof useUser.getState>['user'];

function makeFei(overrides: Partial<Fei> = {}): Fei {
  return {
    numero: 'ZACH-TEST-001',
    date_mise_a_mort: new Date('2026-05-22T00:00:00.000Z'),
    commune_mise_a_mort: 'CHASSENARD',
    heure_mise_a_mort_premiere_carcasse: '08:00',
    heure_evisceration_derniere_carcasse: '09:00',
    examinateur_initial_offline: false,
    examinateur_initial_user_id: examinateurUser!.id,
    examinateur_initial_approbation_mise_sur_le_marche: true,
    examinateur_initial_date_approbation_mise_sur_le_marche: new Date(),
    consommateur_final_usage_domestique: null,
    // FEI is already owned by the PREMIER_DETENTEUR — the carcasse must NOT inherit those values
    fei_current_owner_user_id: 'PD-USER-1',
    fei_current_owner_user_name_cache: 'Pierre Petit',
    fei_current_owner_entity_id: 'PD-ENTITY-1',
    fei_current_owner_entity_name_cache: 'Association de chasseurs',
    fei_current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
    fei_prev_owner_user_id: 'PREV-USER-1',
    fei_prev_owner_entity_id: 'PREV-ENTITY-1',
    fei_prev_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
    ...overrides,
  } as unknown as Fei;
}

describe('createNewCarcasse', () => {
  let createCarcasseSpy: Mock<ReturnType<typeof useZustandStore.getState>['createCarcasse']>;

  beforeEach(() => {
    useUser.setState({ user: examinateurUser });
    createCarcasseSpy = vi.fn();
    useZustandStore.setState({
      carcasses: {},
      createCarcasse: createCarcasseSpy,
    });
  });

  test('new carcasse is born as EXAMINATEUR_INITIAL owned by the examinateur, with empty prev/consommateur', async () => {
    // Examen initial pas encore certifié : la carcasse démarre chez l'examinateur et n'hérite
    // pas des fei_current_owner_*.
    const fei = makeFei({ examinateur_initial_approbation_mise_sur_le_marche: false });

    await createNewCarcasse({
      zacharieCarcasseId: `${fei.numero}_NEW-BRACELET-1`,
      numeroBracelet: 'NEW-BRACELET-1',
      espece: 'Daim',
      nombreDAnimaux: '1',
      fei,
    });

    expect(createCarcasseSpy).toHaveBeenCalledOnce();
    const carcasse = createCarcasseSpy.mock.calls[0][0] as Carcasse;

    expect(carcasse.current_owner_role).toBe(FeiOwnerRole.EXAMINATEUR_INITIAL);
    expect(carcasse.current_owner_user_id).toBe(examinateurUser!.id);
    expect(carcasse.current_owner_user_name_cache).toBe('Marie Martin');
    expect(carcasse.current_owner_entity_id).toBeNull();
    expect(carcasse.current_owner_entity_name_cache).toBeNull();

    expect(carcasse.prev_owner_user_id).toBeNull();
    expect(carcasse.prev_owner_entity_id).toBeNull();
    expect(carcasse.prev_owner_role).toBeNull();

    expect(carcasse.next_owner_role).toBeNull();
    expect(carcasse.next_owner_user_id).toBeNull();
    expect(carcasse.next_owner_entity_id).toBeNull();

    expect(carcasse.consommateur_final_usage_domestique).toBeNull();
    expect(carcasse.svi_automatic_closed_at).toBeNull();
  });

  test('grand gibier carcasse defaults to nombre_d_animaux = 1 regardless of input', async () => {
    const fei = makeFei();

    await createNewCarcasse({
      zacharieCarcasseId: `${fei.numero}_NEW-BRACELET-2`,
      numeroBracelet: 'NEW-BRACELET-2',
      espece: 'Daim',
      nombreDAnimaux: '5', // ignored for gros gibier
      fei,
    });

    const carcasse = createCarcasseSpy.mock.calls[0][0] as Carcasse;
    expect(carcasse.type).toBe(CarcasseType.GROS_GIBIER);
    expect(carcasse.nombre_d_animaux).toBe(1);
  });

  // Examen initial déjà certifié : la fiche est passée au premier détenteur, une carcasse ajoutée
  // ensuite y est directement, pour que les autres membres de l'association la voient aussi.
  test('carcasse added after the examen certification is born as PREMIER_DETENTEUR of the association', async () => {
    const fei = makeFei({
      premier_detenteur_entity_id: 'PD-ENTITY-1',
      premier_detenteur_name_cache: 'Association de chasseurs',
    } as Partial<Fei>);

    await createNewCarcasse({
      zacharieCarcasseId: `${fei.numero}_LATE-1`,
      numeroBracelet: 'LATE-1',
      espece: 'Daim',
      nombreDAnimaux: '1',
      fei,
    });

    const carcasse = createCarcasseSpy.mock.calls[0][0] as Carcasse;
    expect(carcasse.current_owner_role).toBe(FeiOwnerRole.PREMIER_DETENTEUR);
    expect(carcasse.current_owner_user_id).toBe(examinateurUser!.id);
    expect(carcasse.current_owner_entity_id).toBe('PD-ENTITY-1');
    expect(carcasse.current_owner_entity_name_cache).toBe('Association de chasseurs');
    expect(carcasse.prev_owner_role).toBeNull();
    expect(carcasse.prev_owner_user_id).toBeNull();
  });

  test('throws if the user is not an examinateur initial', async () => {
    useUser.setState({
      user: { ...examinateurUser!, numero_cfei: null, est_forme_a_l_examen_initial: false },
    });

    await expect(
      createNewCarcasse({
        zacharieCarcasseId: 'ZACH-TEST-001_X',
        numeroBracelet: 'X',
        espece: 'Daim',
        nombreDAnimaux: '1',
        fei: makeFei(),
      })
    ).rejects.toThrow(/Forbidden/);

    expect(createCarcasseSpy).not.toHaveBeenCalled();
  });
});
