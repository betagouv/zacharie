import 'fake-indexeddb/auto';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { FeiOwnerRole, UserRoles, CarcasseType } from '@prisma/client';

import { createNewCarcasse } from '../src/utils/create-new-carcasse';
import useUser from '../src/zustand/user';
import useZustandStore from '../src/zustand/store';
import type { FeiWithIntermediaires } from '../../api-express/src/types/fei';
import type { CarcasseWithModificationRequests } from '../../api-express/src/types/carcasse';

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

function makeFei(overrides: Partial<FeiWithIntermediaires> = {}): FeiWithIntermediaires {
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
  } as unknown as FeiWithIntermediaires;
}

describe('createNewCarcasse', () => {
  let createCarcasseSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useUser.setState({ user: examinateurUser });
    createCarcasseSpy = vi.fn();
    useZustandStore.setState({
      carcasses: {},
      createCarcasse: createCarcasseSpy,
    });
  });

  test('new carcasse is born as EXAMINATEUR_INITIAL owned by the examinateur, with empty prev/consommateur', async () => {
    // Locks in the new defaults from PR #399. The fei is already past examinateur stage
    // (PREMIER_DETENTEUR with a non-null prev_owner), but the new carcasse must restart
    // the ownership chain from EXAMINATEUR_INITIAL — NOT inherit fei_current_owner_*.
    const fei = makeFei();

    await createNewCarcasse({
      zacharieCarcasseId: `${fei.numero}_NEW-BRACELET-1`,
      numeroBracelet: 'NEW-BRACELET-1',
      espece: 'Daim',
      nombreDAnimaux: '1',
      fei,
    });

    expect(createCarcasseSpy).toHaveBeenCalledOnce();
    const carcasse = createCarcasseSpy.mock.calls[0][0] as CarcasseWithModificationRequests;

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

    const carcasse = createCarcasseSpy.mock.calls[0][0] as CarcasseWithModificationRequests;
    expect(carcasse.type).toBe(CarcasseType.GROS_GIBIER);
    expect(carcasse.nombre_d_animaux).toBe(1);
  });

  // Régression PR #399 × PR #383 — fiche déjà transmise, examinateur ajoute une carcasse en retard.
  // Le code actuel donne TOUJOURS la nouvelle carcasse en EXAMINATEUR_INITIAL, peu importe l'état
  // de la fiche. Ce pin-test documente le comportement actuel : si une refonte future change ça,
  // ce test devra être ajusté EN MÊME TEMPS que les flux aval (PD voit la carcasse "fantôme",
  // step ladder, etc.). À ne pas changer en silence.
  test('late carcasse added to a fiche already owned by PD is STILL born as EXAMINATEUR_INITIAL', async () => {
    const fei = makeFei({
      fei_current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR,
      fei_current_owner_user_id: 'PD-USER-1',
      premier_detenteur_user_id: 'PD-USER-1',
    } as Partial<FeiWithIntermediaires>);

    await createNewCarcasse({
      zacharieCarcasseId: `${fei.numero}_LATE-1`,
      numeroBracelet: 'LATE-1',
      espece: 'Daim',
      nombreDAnimaux: '1',
      fei,
    });

    const carcasse = createCarcasseSpy.mock.calls[0][0] as CarcasseWithModificationRequests;
    expect(carcasse.current_owner_role).toBe(FeiOwnerRole.EXAMINATEUR_INITIAL);
    expect(carcasse.current_owner_user_id).toBe(examinateurUser!.id);
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
