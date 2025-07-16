import { describe, test, expect } from 'vitest';
import dayjs from 'dayjs';

import updateCarcasseStatus, {
  getCarcasseStatusLabel,
  getSimplifiedCarcasseStatus,
} from '../src/utils/get-carcasse-status';
import { Carcasse, CarcasseStatus, CarcasseType, IPM1Decision, IPM2Decision } from '@prisma/client';
import { CarcasseForResponseForRegistry } from '../../api-express/src/types/carcasse';

const createBaseCarcasse = (overrides: Partial<Carcasse> = {}): CarcasseForResponseForRegistry => ({
  zacharie_carcasse_id: 'test-carcasse-id',
  numero_bracelet: '123',
  fei_numero: 'fei-123',
  espece: null,
  type: null,
  nombre_d_animaux: null,
  heure_mise_a_mort: null,
  heure_evisceration: null,
  intermediaire_carcasse_refus_intermediaire_id: null,
  intermediaire_carcasse_refus_motif: null,
  intermediaire_carcasse_manquante: false,
  latest_intermediaire_signed_at: null,
  svi_assigned_to_fei_at: null,
  svi_carcasse_commentaire: null,
  svi_carcasse_status: CarcasseStatus.SANS_DECISION,
  svi_carcasse_status_set_at: null,
  svi_carcasse_archived: null,
  svi_ipm1_date: null,
  svi_ipm1_presentee_inspection: false,
  svi_ipm1_user_id: null,
  svi_ipm1_user_name_cache: null,
  svi_ipm1_protocole: null,
  svi_ipm1_pieces: [],
  svi_ipm1_lesions_ou_motifs: [],
  svi_ipm1_nombre_animaux: null,
  svi_ipm1_commentaire: null,
  svi_ipm1_decision: null,
  svi_ipm1_duree_consigne: null,
  svi_ipm1_poids_consigne: null,
  svi_ipm1_signed_at: null,
  svi_ipm2_date: null,
  svi_ipm2_presentee_inspection: false,
  svi_ipm2_user_id: null,
  svi_ipm2_user_name_cache: null,
  svi_ipm2_protocole: null,
  svi_ipm2_pieces: [],
  svi_ipm2_lesions_ou_motifs: [],
  svi_ipm2_nombre_animaux: null,
  svi_ipm2_commentaire: null,
  svi_ipm2_decision: null,
  svi_ipm2_traitement_assainissant: [],
  svi_ipm2_traitement_assainissant_cuisson_temps: null,
  svi_ipm2_traitement_assainissant_cuisson_temp: null,
  svi_ipm2_traitement_assainissant_congelation_temps: null,
  svi_ipm2_traitement_assainissant_congelation_temp: null,
  svi_ipm2_traitement_assainissant_type: null,
  svi_ipm2_traitement_assainissant_paramètres: null,
  svi_ipm2_traitement_assainissant_etablissement: null,
  svi_ipm2_traitement_assainissant_poids: null,
  svi_ipm2_poids_saisie: null,
  svi_ipm2_signed_at: null,
  // FEI flattened fields
  fei_date_mise_a_mort: null,
  fei_commune_mise_a_mort: null,
  fei_heure_mise_a_mort_premiere_carcasse: null,
  fei_heure_evisceration_derniere_carcasse: null,
  fei_examinateur_initial_date_approbation_mise_sur_le_marche: null,
  fei_premier_detenteur_name_cache: null,
  fei_svi_assigned_at: null,
  fei_svi_entity_id: null,
  fei_svi_user_id: null,
  fei_svi_closed_at: null,
  latest_intermediaire_name_cache: null,
  fei_created_at: dayjs().toDate(),
  fei_updated_at: dayjs().toDate(),
  fei_deleted_at: null,
  fei_automatic_closed_at: null,
  created_at: dayjs().toDate(),
  updated_at: dayjs().toDate(),
  deleted_at: null,
  is_synced: true,
  ...overrides,
});

describe('updateCarcasseStatus', () => {
  describe('Priority 1: intermediaire_carcasse_manquante', () => {
    test('should return MANQUANTE_ETG_COLLECTEUR when carcasse is marked as missing at intermediaire', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: true,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.MANQUANTE_ETG_COLLECTEUR);
    });
  });

  describe('Priority 2: intermediaire_carcasse_refus_intermediaire_id', () => {
    test('should return REFUS_ETG_COLLECTEUR when carcasse is refused at intermediaire', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: 'refus-id',
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.REFUS_ETG_COLLECTEUR);
    });
  });

  describe('Priority 3: svi_ipm1_decision ACCEPTE', () => {
    test('should return ACCEPTE when IPM1 decision is ACCEPTE', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: IPM1Decision.ACCEPTE,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.ACCEPTE);
    });
  });

  describe('Priority 4: No IPM1 and IPM2 dates', () => {
    test('should return ACCEPTE when 10+ days have passed since assignment', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: null,
        svi_ipm2_date: null,
        svi_assigned_to_fei_at: dayjs().subtract(15, 'day').toDate(),
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.ACCEPTE);
    });

    test('should return ACCEPTE when svi_carcasse_status is already ACCEPTE', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: null,
        svi_ipm2_date: null,
        svi_assigned_to_fei_at: dayjs().subtract(5, 'day').toDate(),
        svi_carcasse_status: CarcasseStatus.ACCEPTE,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.ACCEPTE);
    });

    test('should return SANS_DECISION when less than 10 days and status is not ACCEPTE', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: null,
        svi_ipm2_date: null,
        svi_assigned_to_fei_at: dayjs().subtract(5, 'day').toDate(),
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.SANS_DECISION);
    });
  });

  describe('Priority 5: Missing at SVI inspection', () => {
    test('should return MANQUANTE_SVI when not presented for both IPM1 and IPM2', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().toDate(), // Has date to bypass previous condition
        svi_ipm1_presentee_inspection: false,
        svi_ipm2_presentee_inspection: false,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.MANQUANTE_SVI);
    });
  });

  describe('Priority 6: IPM2 traitement assainissant', () => {
    test('should return TRAITEMENT_ASSAINISSANT when IPM2 traitement is specified', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: ['CUISSON'],
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.TRAITEMENT_ASSAINISSANT);
    });
  });

  describe('Priority 7: IPM2 decisions', () => {
    test('should return SAISIE_TOTALE when IPM2 decision includes SAISIE_TOTALE', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: IPM2Decision.SAISIE_TOTALE,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.SAISIE_TOTALE);
    });

    test('should return SAISIE_PARTIELLE when IPM2 decision includes SAISIE_PARTIELLE', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: IPM2Decision.SAISIE_PARTIELLE,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.SAISIE_PARTIELLE);
    });

    test('should return LEVEE_DE_CONSIGNE when IPM2 decision includes LEVEE_DE_LA_CONSIGNE', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: IPM2Decision.LEVEE_DE_LA_CONSIGNE,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.LEVEE_DE_CONSIGNE);
    });

    test('should return TRAITEMENT_ASSAINISSANT when IPM2 decision includes TRAITEMENT_ASSAINISSANT', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: IPM2Decision.TRAITEMENT_ASSAINISSANT,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.TRAITEMENT_ASSAINISSANT);
    });
  });

  describe('Priority 8: IPM1 decisions', () => {
    test('should return CONSIGNE when IPM1 decision includes MISE_EN_CONSIGNE', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: IPM1Decision.MISE_EN_CONSIGNE,
        svi_ipm1_date: dayjs().toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: null,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.CONSIGNE);
    });
  });

  describe('Priority 9: Fallback 10+ days rule', () => {
    test('should return ACCEPTE when 10+ days have passed (fallback)', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().subtract(15, 'day').toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: null,
        svi_assigned_to_fei_at: dayjs().subtract(15, 'day').toDate(),
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.ACCEPTE);
    });
  });

  describe('Default case', () => {
    test('should return SANS_DECISION as default when no other conditions are met', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().subtract(5, 'day').toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: null,
        svi_assigned_to_fei_at: dayjs().subtract(5, 'day').toDate(),
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.SANS_DECISION);
    });
  });

  describe('Multiple conditions (priority order)', () => {
    test('should prioritize MANQUANTE_ETG_COLLECTEUR over other conditions', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: true,
        intermediaire_carcasse_refus_intermediaire_id: 'refus-id',
        svi_ipm1_decision: IPM1Decision.ACCEPTE,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.MANQUANTE_ETG_COLLECTEUR);
    });

    test('should prioritize REFUS_ETG_COLLECTEUR over IPM1 ACCEPTE', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: 'refus-id',
        svi_ipm1_decision: IPM1Decision.ACCEPTE,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.REFUS_ETG_COLLECTEUR);
    });

    test('should prioritize SAISIE_TOTALE over SAISIE_PARTIELLE when both are present', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: IPM2Decision.SAISIE_TOTALE,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.SAISIE_TOTALE);
    });
  });

  describe('Edge cases', () => {
    test('should handle null svi_assigned_to_fei_at gracefully', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: null,
        svi_ipm2_date: null,
        svi_assigned_to_fei_at: null,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.SANS_DECISION);
    });

    test('should handle empty arrays for svi_ipm2_traitement_assainissant', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().subtract(5, 'day').toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.SANS_DECISION);
    });

    test('should handle empty arrays for svi_ipm2_decision', () => {
      const carcasse = createBaseCarcasse({
        intermediaire_carcasse_manquante: false,
        intermediaire_carcasse_refus_intermediaire_id: null,
        svi_ipm1_decision: null,
        svi_ipm1_date: dayjs().subtract(5, 'day').toDate(),
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_traitement_assainissant: [],
        svi_ipm2_decision: null,
      });

      const result = updateCarcasseStatus(carcasse);

      expect(result).toBe(CarcasseStatus.SANS_DECISION);
    });
  });
});

describe('getCarcasseStatusLabel', () => {
  describe('MANQUANTE status labels', () => {
    test('should return "Manquante" for MANQUANTE_ETG_COLLECTEUR with GROS_GIBIER', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
        type: CarcasseType.GROS_GIBIER,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Manquante');
    });

    test('should return "Manquant" for MANQUANTE_ETG_COLLECTEUR with PETIT_GIBIER', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
        type: CarcasseType.PETIT_GIBIER,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Manquant');
    });

    test('should return "Manquante" for MANQUANTE_SVI with GROS_GIBIER', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.MANQUANTE_SVI,
        type: CarcasseType.GROS_GIBIER,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Manquante');
    });

    test('should return "Manquant" for MANQUANTE_SVI with PETIT_GIBIER', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.MANQUANTE_SVI,
        type: CarcasseType.PETIT_GIBIER,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Manquant');
    });
  });

  describe('Other status labels', () => {
    test('should return "En traitement assainissant" for TRAITEMENT_ASSAINISSANT', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.TRAITEMENT_ASSAINISSANT,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('En traitement assainissant');
    });

    test('should return "Saisie totale" for SAISIE_TOTALE', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SAISIE_TOTALE,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Saisie totale');
    });

    test('should return "Saisie partielle" for SAISIE_PARTIELLE', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SAISIE_PARTIELLE,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Saisie partielle');
    });

    test('should return "Levée de consigne" for LEVEE_DE_CONSIGNE', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.LEVEE_DE_CONSIGNE,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Levée de consigne');
    });
  });

  describe('CONSIGNE status labels', () => {
    test('should return "Consignée" for CONSIGNE with GROS_GIBIER', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.CONSIGNE,
        type: CarcasseType.GROS_GIBIER,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Consignée');
    });

    test('should return "Consigné" for CONSIGNE with PETIT_GIBIER', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.CONSIGNE,
        type: CarcasseType.PETIT_GIBIER,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Consigné');
    });
  });

  describe('SANS_DECISION and default cases', () => {
    test('should return "Acceptée" for SANS_DECISION with svi_carcasse_status_set_at and GROS_GIBIER', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: dayjs().toDate(),
        type: CarcasseType.GROS_GIBIER,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Acceptée');
    });

    test('should return "Accepté" for SANS_DECISION with svi_carcasse_status_set_at and PETIT_GIBIER', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: dayjs().toDate(),
        type: CarcasseType.PETIT_GIBIER,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Accepté');
    });

    test('should return "Sans décision" for SANS_DECISION without status_set_at', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: null,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Sans décision');
    });

    test('should return "Sans décision" for null status without status_set_at', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
        svi_carcasse_status_set_at: null,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Sans décision');
    });
  });

  describe('Edge cases for type handling', () => {
    test('should handle null type as GROS_GIBIER for MANQUANTE status', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.MANQUANTE_SVI,
        type: null,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Manquante');
    });

    test('should handle null type as GROS_GIBIER for CONSIGNE status', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.CONSIGNE,
        type: null,
      });

      const result = getCarcasseStatusLabel(carcasse);

      expect(result).toBe('Consignée');
    });
  });
});

describe('getSimplifiedCarcasseStatus', () => {
  describe('Status mapping to "en cours de traitement"', () => {
    test('should return "en cours de traitement" for SANS_DECISION', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SANS_DECISION,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('en cours de traitement');
    });

    test('should return "en cours de traitement" for CONSIGNE', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.CONSIGNE,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('en cours de traitement');
    });

    test('should return "en cours de traitement" for null status (default case)', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: null,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('en cours de traitement');
    });
  });

  describe('Status mapping to "accepté"', () => {
    test('should return "accepté" for ACCEPTE', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.ACCEPTE,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('accepté');
    });

    test('should return "accepté" for LEVEE_DE_CONSIGNE', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.LEVEE_DE_CONSIGNE,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('accepté');
    });

    test('should return "accepté" for TRAITEMENT_ASSAINISSANT', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.TRAITEMENT_ASSAINISSANT,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('accepté');
    });
  });

  describe('Status mapping to "refusé"', () => {
    test('should return "refusé" for MANQUANTE_ETG_COLLECTEUR', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('refusé');
    });

    test('should return "refusé" for REFUS_ETG_COLLECTEUR', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.REFUS_ETG_COLLECTEUR,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('refusé');
    });

    test('should return "refusé" for MANQUANTE_SVI', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.MANQUANTE_SVI,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('refusé');
    });

    test('should return "refusé" for SAISIE_TOTALE', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SAISIE_TOTALE,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('refusé');
    });

    test('should return "refusé" for SAISIE_PARTIELLE', () => {
      const carcasse = createBaseCarcasse({
        svi_carcasse_status: CarcasseStatus.SAISIE_PARTIELLE,
      });

      const result = getSimplifiedCarcasseStatus(carcasse);

      expect(result).toBe('refusé');
    });
  });
});
