import { Carcasse, CarcasseStatus, CarcasseType, FeiOwnerRole } from '@prisma/client';
import type useZustandStore from '@app/zustand/store';
import type { useCarcassesIntermediairesForCarcasse } from '@app/utils/get-carcasses-intermediaires';

export type CardViewRole = 'chasseur' | 'etg-coll' | 'svi';
export type CardUiState =
  | 'creation'
  | 'transmise'
  | 'manquante-etg'
  | 'refusee-etg'
  | 'acceptee-etg'
  | 'manquante-svi'
  | 'mise-en-consigne'
  | 'saisie-partielle'
  | 'saisie-totale'
  | 'accepte-svi';
export type CardAccent = 'red' | 'blue' | 'orange' | 'gray' | null;

export interface CardDisplay {
  uiState: CardUiState;
  iconId: string | null;
  accentColor: CardAccent;
  statusLabel: string | null;
  showStatusLine: boolean;
}

export interface CardDisplayParams {
  carcasse: Carcasse;
  latestIntermediaire: ReturnType<typeof useCarcassesIntermediairesForCarcasse>[number] | undefined;
  entities: ReturnType<typeof useZustandStore.getState>['entities'];
  viewRole: CardViewRole;
  forceRefus?: boolean;
  forceManquante?: boolean;
  forceAccept?: boolean;
}

export function deriveCarcasseUiState(
  carcasse: Carcasse,
  latestIntermediaire: CardDisplayParams['latestIntermediaire'],
  overrides: { forceRefus?: boolean; forceManquante?: boolean; forceAccept?: boolean }
): CardUiState {
  if (!carcasse.svi_ipm1_date && !carcasse.svi_ipm2_date) {
    if (overrides.forceRefus) return 'refusee-etg';
    if (overrides.forceManquante) return 'manquante-etg';
    if (overrides.forceAccept) return 'acceptee-etg';
  }

  const status = carcasse.svi_carcasse_status ?? CarcasseStatus.SANS_DECISION;

  switch (status) {
    case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR:
      return 'manquante-etg';
    case CarcasseStatus.REFUS_ETG_COLLECTEUR:
      return 'refusee-etg';
    case CarcasseStatus.MANQUANTE_SVI:
      return 'manquante-svi';
    case CarcasseStatus.SAISIE_TOTALE:
      return 'saisie-totale';
    case CarcasseStatus.SAISIE_PARTIELLE:
      return 'saisie-partielle';
    case CarcasseStatus.CONSIGNE:
      return 'mise-en-consigne';
    case CarcasseStatus.ACCEPTE:
    case CarcasseStatus.LEVEE_DE_CONSIGNE:
    case CarcasseStatus.TRAITEMENT_ASSAINISSANT:
      return 'accepte-svi';
    case CarcasseStatus.SANS_DECISION: {
      // On lit l'état de possession de la carcasse elle-même (source de vérité),
      // pas le snapshot FEI qui peut être périmé après un « Retour à l'envoyeur ».
      const isCreation =
        (carcasse.current_owner_role === FeiOwnerRole.EXAMINATEUR_INITIAL ||
          carcasse.current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) &&
        !carcasse.next_owner_role;
      if (isCreation) return 'creation';
      if (latestIntermediaire?.decision_at && latestIntermediaire?.intermediaire_role === FeiOwnerRole.ETG) {
        return 'acceptee-etg';
      }
      return 'transmise';
    }
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      return 'transmise';
    }
  }
}

export function getCarcasseCardDisplay(params: CardDisplayParams): CardDisplay {
  const { carcasse, latestIntermediaire, entities, viewRole, forceRefus, forceManquante, forceAccept } =
    params;

  const uiState = deriveCarcasseUiState(carcasse, latestIntermediaire, {
    forceRefus,
    forceManquante,
    forceAccept,
  });

  const isPetitGibier = carcasse.type === CarcasseType.PETIT_GIBIER;
  const manquantWord = isPetitGibier ? 'Manquant' : 'Manquante';
  const refuseWord = isPetitGibier ? 'Refusé' : 'Refusée';
  const accepteWord = isPetitGibier ? 'Accepté' : 'Acceptée';

  const intermediaireEntity = latestIntermediaire?.intermediaire_entity_id
    ? entities[latestIntermediaire.intermediaire_entity_id]
    : null;
  const intermediaireName = intermediaireEntity?.nom_d_usage ?? '';

  if (viewRole === 'chasseur') {
    if (uiState === 'creation') {
      return { uiState, iconId: null, accentColor: null, statusLabel: null, showStatusLine: false };
    }
    if (uiState === 'transmise' || uiState === 'acceptee-etg' || uiState === 'mise-en-consigne') {
      return {
        uiState,
        iconId: 'fr-icon-refresh-line',
        accentColor: 'gray',
        statusLabel: 'En cours de traitement',
        showStatusLine: true,
      };
    }
    if (uiState === 'saisie-partielle') {
      return {
        uiState,
        iconId: 'fr-icon-checkbox-circle-line',
        accentColor: 'blue',
        statusLabel: `${accepteWord} partiellement par le service vétérinaire`,
        showStatusLine: true,
      };
    }
    if (uiState === 'saisie-totale') {
      return {
        uiState,
        iconId: 'fr-icon-close-circle-line',
        accentColor: 'red',
        statusLabel: `${refuseWord} par le service vétérinaire`,
        showStatusLine: true,
      };
    }
  }

  if (viewRole === 'svi' && (uiState === 'acceptee-etg' || uiState === 'transmise')) {
    return { uiState, iconId: null, accentColor: null, statusLabel: null, showStatusLine: false };
  }

  switch (uiState) {
    case 'creation':
    case 'transmise':
      return { uiState, iconId: null, accentColor: null, statusLabel: null, showStatusLine: false };
    case 'manquante-etg':
      return {
        uiState,
        iconId: 'fr-icon-alert-line',
        accentColor: 'red',
        statusLabel: intermediaireName ? `${manquantWord} pour ${intermediaireName}` : `${manquantWord}`,
        showStatusLine: true,
      };
    case 'refusee-etg':
      return {
        uiState,
        iconId: 'fr-icon-close-circle-line',
        accentColor: 'red',
        statusLabel: intermediaireName ? `${refuseWord} par ${intermediaireName}` : `${refuseWord}`,
        showStatusLine: true,
      };
    case 'acceptee-etg':
      return {
        uiState,
        iconId: 'fr-icon-checkbox-circle-line',
        accentColor: 'blue',
        statusLabel: intermediaireName ? `${accepteWord} par ${intermediaireName}` : `${accepteWord}`,
        showStatusLine: true,
      };
    case 'manquante-svi':
      return {
        uiState,
        iconId: 'fr-icon-alert-line',
        accentColor: 'red',
        statusLabel: `${manquantWord} pour le service vétérinaire`,
        showStatusLine: true,
      };
    case 'mise-en-consigne':
      return {
        uiState,
        iconId: 'fr-icon-time-line',
        accentColor: 'orange',
        statusLabel: 'Mise en consigne par le service vétérinaire',
        showStatusLine: true,
      };
    case 'saisie-partielle':
      return {
        uiState,
        iconId: 'fr-icon-error-warning-line',
        accentColor: 'red',
        statusLabel: `${refuseWord} partiellement par le service vétérinaire`,
        showStatusLine: true,
      };
    case 'saisie-totale':
      return {
        uiState,
        iconId: 'fr-icon-close-circle-line',
        accentColor: 'red',
        statusLabel: `${refuseWord} par le service vétérinaire`,
        showStatusLine: true,
      };
    case 'accepte-svi':
      return {
        uiState,
        iconId: 'fr-icon-checkbox-circle-line',
        accentColor: 'blue',
        statusLabel: `${accepteWord} par le service vétérinaire`,
        showStatusLine: true,
      };
  }
}
