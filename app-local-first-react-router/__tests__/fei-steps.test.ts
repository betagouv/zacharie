import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { computeFeiSteps } from '../src/utils/fei-steps';
import { FeiDone } from '../../api-express/src/types/fei';
import { FeiIntermediaire } from '../src/types/fei-intermediaire';
import { User, UserRoles, EntityTypes } from '@prisma/client';

// Mock the Sentry capture function using vi.hoisted()
const mockCapture = vi.hoisted(() => vi.fn());
vi.mock('@app/services/sentry', () => ({
  capture: mockCapture,
}));

// Mock data helpers
const createMockUser = (roles: UserRoles[], id = 'user-1'): User => ({
  id,
  email: 'test@example.com',
  telephone: null,
  prenom: 'Test',
  nom_de_famille: 'User',
  numero_cfei: null,
  prochain_bracelet_a_utiliser: 1,
  addresse_ligne_1: null,
  addresse_ligne_2: null,
  code_postal: null,
  ville: null,
  user_entities_vivible_checkbox: null,
  roles,
  created_at: new Date(),
  updated_at: new Date(),
  last_login_at: null,
  last_seen_at: null,
  deleted_at: null,
  onboarded_at: null,
  notifications: [],
  web_push_tokens: [],
  prefilled: false,
  activated: true,
  activated_at: null,
  is_synced: true,
  brevo_contact_id: null,
  at_least_one_fei_treated: null,
});

const createMockFei = (overrides: Partial<FeiDone> = {}): FeiDone => ({
  id: 1,
  numero: 'FEI-2024-001',
  date_mise_a_mort: new Date(),
  commune_mise_a_mort: 'Test City',
  heure_mise_a_mort_premiere_carcasse: '10:00',
  heure_evisceration_derniere_carcasse: '10:00',
  created_by_user_id: 'user-1',
  resume_nombre_de_carcasses: '5',
  automatic_closed_at: null,
  examinateur_initial_offline: false,
  examinateur_initial_user_id: 'user-1',
  examinateur_initial_approbation_mise_sur_le_marche: true,
  examinateur_initial_date_approbation_mise_sur_le_marche: new Date(),
  premier_detenteur_offline: false,
  premier_detenteur_user_id: 'user-1',
  premier_detenteur_entity_id: null,
  premier_detenteur_name_cache: 'Premier Détenteur',
  premier_detenteur_depot_type: null,
  premier_detenteur_depot_entity_id: null,
  premier_detenteur_depot_ccg_at: null,
  premier_detenteur_transport_type: null,
  premier_detenteur_transport_date: null,
  premier_detenteur_prochain_detenteur_type_cache: null,
  premier_detenteur_prochain_detenteur_id_cache: null,
  intermediaire_closed_at: null,
  intermediaire_closed_by_user_id: null,
  intermediaire_closed_by_entity_id: null,
  latest_intermediaire_user_id: null,
  latest_intermediaire_entity_id: null,
  latest_intermediaire_name_cache: null,
  svi_assigned_at: null,
  svi_entity_id: null,
  svi_user_id: null,
  svi_closed_at: null,
  svi_closed_by_user_id: null,
  fei_current_owner_user_id: null,
  fei_current_owner_user_name_cache: null,
  fei_current_owner_entity_id: null,
  fei_current_owner_entity_name_cache: null,
  fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
  fei_current_owner_wants_to_transfer: false,
  fei_next_owner_user_id: null,
  fei_next_owner_user_name_cache: null,
  fei_next_owner_entity_id: null,
  fei_next_owner_entity_name_cache: null,
  fei_next_owner_role: null,
  fei_prev_owner_user_id: null,
  fei_prev_owner_entity_id: null,
  fei_prev_owner_role: null,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  is_synced: true,
  CarcasseIntermediaire: [],
  ...overrides,
});

const createMockIntermediaire = (overrides: Partial<FeiIntermediaire> = {}): FeiIntermediaire => ({
  id: 'user-1_123456',
  created_at: new Date(),
  fei_numero: 'FEI-2024-001',
  intermediaire_user_id: 'user-1',
  intermediaire_entity_id: 'entity-1',
  intermediaire_role: UserRoles.COLLECTEUR_PRO,
  prise_en_charge_at: new Date(),
  intermediaire_depot_type: null,
  intermediaire_depot_entity_id: null,
  intermediaire_prochain_detenteur_type_cache: EntityTypes.ETG,
  intermediaire_prochain_detenteur_id_cache: 'entity-etg',
  ...overrides,
});

describe('computeFeiSteps', () => {
  const defaultParams = {
    entitiesIdsWorkingDirectlyFor: [],
    entitiesIdsWorkingDirectlyAndIndirectlyFor: [],
  };

  beforeEach(() => {
    mockCapture.mockClear();
  });

  afterEach(() => {
    expect(mockCapture).not.toHaveBeenCalled();
  });

  describe('Basic step structure', () => {
    test('should create basic steps with examinateur and premier detenteur', () => {
      const fei = createMockFei();
      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.steps).toHaveLength(4); // examinateur, premier_detenteur, etg, svi
      expect(result.steps[0].role).toBe(UserRoles.EXAMINATEUR_INITIAL);
      expect(result.steps[1].role).toBe(UserRoles.PREMIER_DETENTEUR);
      expect(result.steps[2].role).toBe(UserRoles.ETG);
      expect(result.steps[3].role).toBe(UserRoles.SVI);
    });

    test('should add intermediaires to steps', () => {
      const fei = createMockFei();
      const intermediaires = [
        createMockIntermediaire({
          intermediaire_role: UserRoles.COLLECTEUR_PRO,
          intermediaire_prochain_detenteur_type_cache: EntityTypes.ETG,
        }),
      ];

      const result = computeFeiSteps({
        fei,
        intermediaires,
        user: null,
        ...defaultParams,
      });

      expect(result.steps).toHaveLength(5); // examinateur, premier_detenteur, collecteur, etg, svi
      expect(result.steps[2].role).toBe(UserRoles.COLLECTEUR_PRO);
    });

    test('should not add ETG/SVI steps when intermediaire is closed', () => {
      const fei = createMockFei({
        intermediaire_closed_at: new Date(),
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.steps).toHaveLength(2); // only examinateur, premier_detenteur
    });

    test('should not duplicate ETG step when last intermediaire is ETG->SVI', () => {
      const fei = createMockFei();
      const intermediaires = [
        createMockIntermediaire({
          intermediaire_role: UserRoles.ETG,
          intermediaire_prochain_detenteur_type_cache: EntityTypes.SVI,
        }),
      ];

      const result = computeFeiSteps({
        fei,
        intermediaires,
        user: null,
        ...defaultParams,
      });

      expect(result.steps).toHaveLength(4); // examinateur, premier_detenteur, etg, svi
      expect(result.steps[2].role).toBe(UserRoles.ETG);
      expect(result.steps[3].role).toBe(UserRoles.SVI);
    });
  });

  describe('Current step calculation', () => {
    test('should return step 1 for examinateur initial', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStep).toBe(1);
    });

    test('should return step 2 for premier detenteur', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.PREMIER_DETENTEUR,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStep).toBe(2);
    });

    test('should return last step when SVI is assigned', () => {
      const fei = createMockFei({
        svi_assigned_at: new Date(),
        fei_current_owner_role: UserRoles.SVI,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStep).toBe(result.steps.length);
    });

    test('should return last step when intermediaire is closed', () => {
      const fei = createMockFei({
        intermediaire_closed_at: new Date(),
        // When intermediaire is closed, the current owner role should be set appropriately
        // This depends on the business logic - could be ETG or another role after intermediaires
        fei_current_owner_role: UserRoles.ETG, // or whatever role comes after intermediaires are closed
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStep).toBe(result.steps.length);
    });
  });

  describe('Current step labels', () => {
    test('should return "Clôturée" when fei is closed', () => {
      const fei = createMockFei({
        automatic_closed_at: new Date(),
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStepLabel).toBe('Clôturée');
    });

    test('should return "Examen initial" for examinateur initial', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStepLabel).toBe('Examen initial');
    });

    test('should return "Validation par le premier détenteur" when no next owner', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.PREMIER_DETENTEUR,
        fei_next_owner_role: null,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStepLabel).toBe('Validation par le premier détenteur');
    });

    test('should return "Fiche envoyée, pas encore traitée" when next owner exists', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.PREMIER_DETENTEUR,
        fei_next_owner_role: UserRoles.COLLECTEUR_PRO,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStepLabel).toBe('Fiche envoyée, pas encore traitée');
    });

    test('should return "Inspection par le SVI" when SVI is assigned', () => {
      const fei = createMockFei({
        svi_assigned_at: new Date(),
        fei_current_owner_role: UserRoles.SVI,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.currentStepLabel).toBe('Inspection par le SVI');
    });

    test('should return "Transport" for collecteur pro', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.COLLECTEUR_PRO,
        fei_current_owner_entity_id: 'collecteur-entity',
      });
      const intermediaires = [
        createMockIntermediaire({
          intermediaire_role: UserRoles.COLLECTEUR_PRO,
          intermediaire_prochain_detenteur_type_cache: EntityTypes.COLLECTEUR_PRO,
        }),
      ];

      const result = computeFeiSteps({
        fei,
        intermediaires,
        user: null,
        ...defaultParams,
      });

      expect(result.currentStepLabel).toBe('Transport');
    });

    test('should return "Réception par un établissement de traitement" for ETG', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.ETG,
        fei_current_owner_entity_id: 'etg-entity',
      });
      const intermediaires = [
        createMockIntermediaire({
          id: 'etg-user_123456',
          intermediaire_role: UserRoles.ETG,
          intermediaire_prochain_detenteur_type_cache: EntityTypes.SVI,
        }),
      ];

      const result = computeFeiSteps({
        fei,
        intermediaires,
        user: null,
        ...defaultParams,
      });

      expect(result.currentStepLabel).toBe('Réception par un établissement de traitement');
    });
  });

  describe('Next step labels', () => {
    test('should return correct next step for examen initial', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.nextStepLabel).toBe('Validation par le premier détenteur');
    });

    test('should return correct next step for premier detenteur', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.PREMIER_DETENTEUR,
        fei_next_owner_role: null,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.nextStepLabel).toBe('Transport vers un établissement de traitement');
    });

    test('should return "Clôturée" for SVI inspection', () => {
      const fei = createMockFei({
        svi_assigned_at: new Date(),
        fei_current_owner_role: UserRoles.SVI,
      });

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.nextStepLabel).toBe('Clôturée');
    });
  });

  describe('Simple status calculation', () => {
    describe('For EXAMINATEUR_INITIAL', () => {
      const examinateurInitialUser = createMockUser([UserRoles.EXAMINATEUR_INITIAL]);

      test('should return "À compléter" for examen initial', () => {
        const fei = createMockFei({
          fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [],
          user: examinateurInitialUser,
          ...defaultParams,
        });

        expect(result.simpleStatus).toBe('À compléter');
      });

      test('should return "En cours" for other steps', () => {
        const fei = createMockFei({
          svi_assigned_at: new Date(),
          fei_current_owner_role: UserRoles.SVI,
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [],
          user: examinateurInitialUser,
          ...defaultParams,
        });

        expect(result.simpleStatus).toBe('En cours');
      });
    });

    describe('For PREMIER_DETENTEUR', () => {
      const premierDetenteurUser = createMockUser([UserRoles.PREMIER_DETENTEUR]);

      test('should return "À compléter" for premier detenteur validation', () => {
        const fei = createMockFei({
          fei_current_owner_role: UserRoles.PREMIER_DETENTEUR,
          fei_next_owner_role: null,
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [],
          user: premierDetenteurUser,
          ...defaultParams,
        });

        expect(result.simpleStatus).toBe('À compléter');
      });
    });

    describe('For SVI', () => {
      const sviUser = createMockUser([UserRoles.SVI]);

      test('should return "À compléter" for SVI inspection', () => {
        const fei = createMockFei({
          svi_assigned_at: new Date(),
          fei_current_owner_role: UserRoles.SVI,
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [],
          user: sviUser,
          ...defaultParams,
        });

        expect(result.simpleStatus).toBe('À compléter');
      });

      test('should return "En cours" for other steps', () => {
        const fei = createMockFei({
          fei_current_owner_role: UserRoles.PREMIER_DETENTEUR,
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [],
          user: sviUser,
          ...defaultParams,
        });

        expect(result.simpleStatus).toBe('En cours');
      });
    });

    describe('For COLLECTEUR_PRO and ETG', () => {
      const collecteurProUser = createMockUser([UserRoles.COLLECTEUR_PRO]);
      const collecteurProIntermediaire = createMockIntermediaire({
        intermediaire_role: UserRoles.COLLECTEUR_PRO,
        intermediaire_prochain_detenteur_type_cache: EntityTypes.COLLECTEUR_PRO,
      });

      test('should return "À compléter" when user works directly for next owner entity', () => {
        const fei = createMockFei({
          fei_current_owner_role: UserRoles.COLLECTEUR_PRO,
          fei_next_owner_entity_id: 'entity-1',
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [collecteurProIntermediaire],
          user: collecteurProUser,
          entitiesIdsWorkingDirectlyFor: ['entity-1'],
          entitiesIdsWorkingDirectlyAndIndirectlyFor: ['entity-1'],
        });

        expect(result.simpleStatus).toBe('À compléter');
      });

      test('should return "À compléter" when user works indirectly for next owner entity', () => {
        const fei = createMockFei({
          fei_current_owner_role: UserRoles.COLLECTEUR_PRO,
          fei_next_owner_entity_id: 'entity-1',
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [collecteurProIntermediaire],
          user: collecteurProUser,
          entitiesIdsWorkingDirectlyFor: [],
          entitiesIdsWorkingDirectlyAndIndirectlyFor: ['entity-1'],
        });

        expect(result.simpleStatus).toBe('À compléter');
      });

      test('should return "En cours" when user does not work for next owner entity', () => {
        const fei = createMockFei({
          fei_current_owner_role: UserRoles.COLLECTEUR_PRO,
          fei_next_owner_entity_id: 'entity-1',
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [collecteurProIntermediaire],
          user: collecteurProUser,
          entitiesIdsWorkingDirectlyFor: ['entity-2'],
          entitiesIdsWorkingDirectlyAndIndirectlyFor: ['entity-2'],
        });

        expect(result.simpleStatus).toBe('En cours');
      });

      test('should return "À compléter" when user works for current owner entity', () => {
        const fei = createMockFei({
          fei_current_owner_role: UserRoles.COLLECTEUR_PRO,
          fei_current_owner_entity_id: 'entity-1',
          fei_next_owner_entity_id: null,
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [collecteurProIntermediaire],
          user: collecteurProUser,
          entitiesIdsWorkingDirectlyFor: ['entity-1'],
          entitiesIdsWorkingDirectlyAndIndirectlyFor: ['entity-1'],
        });

        expect(result.simpleStatus).toBe('À compléter');
      });

      test('should return "En cours" when COLLECTEUR_PRO (not ETG) user and step is "Réception par un établissement de traitement"', () => {
        const collecteurProOnlyUser = createMockUser([UserRoles.COLLECTEUR_PRO]);
        const etgIntermediaire = createMockIntermediaire({
          id: 'etg-user_123456',
          intermediaire_role: UserRoles.ETG,
          intermediaire_prochain_detenteur_type_cache: EntityTypes.SVI,
        });

        const fei = createMockFei({
          fei_current_owner_role: UserRoles.ETG,
          fei_current_owner_entity_id: 'etg-entity',
          fei_next_owner_entity_id: 'svi-entity',
          // This will result in currentStepLabel being "Réception par un établissement de traitement"
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [etgIntermediaire],
          user: collecteurProOnlyUser,
          entitiesIdsWorkingDirectlyFor: ['etg-entity'],
          entitiesIdsWorkingDirectlyAndIndirectlyFor: ['etg-entity'],
        });

        expect(result.currentStepLabel).toBe('Réception par un établissement de traitement');
        expect(result.simpleStatus).toBe('En cours');
      });

      test('should NOT return "En cours" early when user has both COLLECTEUR_PRO and ETG roles and step is "Réception par un établissement de traitement"', () => {
        const collecteurProEtgUser = createMockUser([UserRoles.COLLECTEUR_PRO, UserRoles.ETG]);
        const etgIntermediaire = createMockIntermediaire({
          id: 'etg-user_123456',
          intermediaire_role: UserRoles.ETG,
          intermediaire_prochain_detenteur_type_cache: EntityTypes.SVI,
        });

        const fei = createMockFei({
          fei_current_owner_role: UserRoles.ETG,
          fei_current_owner_entity_id: 'etg-entity',
          fei_next_owner_entity_id: 'svi-entity',
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [etgIntermediaire],
          user: collecteurProEtgUser,
          entitiesIdsWorkingDirectlyFor: ['etg-entity'],
          entitiesIdsWorkingDirectlyAndIndirectlyFor: ['etg-entity'],
        });

        expect(result.currentStepLabel).toBe('Réception par un établissement de traitement');
        // Should continue with existing logic instead of returning "En cours" early
        expect(result.simpleStatus).toBe('En cours'); // Because user works for the entity
      });

      test('should continue with existing logic when COLLECTEUR_PRO (not ETG) user and step is NOT "Réception par un établissement de traitement"', () => {
        const collecteurProOnlyUser = createMockUser([UserRoles.COLLECTEUR_PRO]);
        const collecteurProIntermediaire = createMockIntermediaire({
          intermediaire_role: UserRoles.COLLECTEUR_PRO,
          intermediaire_prochain_detenteur_type_cache: EntityTypes.ETG,
        });

        const fei = createMockFei({
          fei_current_owner_role: UserRoles.COLLECTEUR_PRO,
          fei_current_owner_entity_id: 'collecteur-entity',
          // This will result in currentStepLabel being "Transport vers un établissement de traitement"
        });

        const result = computeFeiSteps({
          fei,
          intermediaires: [collecteurProIntermediaire],
          user: collecteurProOnlyUser,
          entitiesIdsWorkingDirectlyFor: ['collecteur-entity'],
          entitiesIdsWorkingDirectlyAndIndirectlyFor: ['collecteur-entity'],
        });

        expect(result.currentStepLabel).toBe('Transport vers un établissement de traitement');
        // Should follow existing logic, not the new early return
        expect(result.simpleStatus).toBe('En cours');
      });
    });

    describe('Closed status', () => {
      test('should return "Clôturée" when fei is closed', () => {
        const fei = createMockFei({
          automatic_closed_at: new Date(),
        });
        const examinateurInitialUser = createMockUser([UserRoles.EXAMINATEUR_INITIAL]);

        const result = computeFeiSteps({
          fei,
          intermediaires: [],
          user: examinateurInitialUser,
          ...defaultParams,
        });

        expect(result.simpleStatus).toBe('Clôturée');
      });

      test('should return "Clôturée" when SVI is closed', () => {
        const fei = createMockFei({
          svi_closed_at: new Date(),
        });
        const sviUser = createMockUser([UserRoles.SVI]);
        const result = computeFeiSteps({
          fei,
          intermediaires: [],
          user: sviUser,
          ...defaultParams,
        });

        expect(result.simpleStatus).toBe('Clôturée');
      });

      test('should return "Clôturée" when intermediaire is closed', () => {
        const fei = createMockFei({
          intermediaire_closed_at: new Date(),
        });
        const collecteurProUser = createMockUser([UserRoles.COLLECTEUR_PRO]);
        const result = computeFeiSteps({
          fei,
          intermediaires: [],
          user: collecteurProUser,
          ...defaultParams,
        });

        expect(result.simpleStatus).toBe('Clôturée');
      });
    });
  });

  describe('Edge cases', () => {
    test('should handle null user', () => {
      const fei = createMockFei();
      const user = null;
      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user,
        ...defaultParams,
      });

      expect(result.simpleStatus).toBe('En cours');
    });

    test('should handle empty intermediaires array', () => {
      const fei = createMockFei();

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user: null,
        ...defaultParams,
      });

      expect(result.steps).toHaveLength(4); // examinateur, premier_detenteur, etg, svi
    });

    test('should handle multiple intermediaires', () => {
      const fei = createMockFei();
      const intermediaires = [
        createMockIntermediaire({
          id: 'user-1_123456',
          intermediaire_role: UserRoles.COLLECTEUR_PRO,
        }),
        createMockIntermediaire({
          id: 'user-2_123457',
          intermediaire_role: UserRoles.ETG,
        }),
      ];

      const result = computeFeiSteps({
        fei,
        intermediaires,
        user: null,
        ...defaultParams,
      });

      expect(result.steps).toHaveLength(6); // examinateur, premier_detenteur, collecteur, etg, etg, svi
    });

    test('should handle user with multiple roles', () => {
      const fei = createMockFei({
        fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
      });
      const user = createMockUser([UserRoles.EXAMINATEUR_INITIAL, UserRoles.PREMIER_DETENTEUR]);

      const result = computeFeiSteps({
        fei,
        intermediaires: [],
        user,
        ...defaultParams,
      });

      expect(result.simpleStatus).toBe('À compléter');
    });
  });
});
