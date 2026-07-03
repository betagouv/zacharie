import { Fei, Carcasse, CarcasseStatus, User } from '@prisma/client';
import updateCarcasseStatus from './get-carcasse-status';
import { EntityWithUserRelation } from '@api/src/types/entity';
import { isRoleCircuitCourt } from './circuit-court';

// États terminaux d'une carcasse : elle ne progressera plus.
// CONSIGNE (attente IPM2) et SANS_DECISION ne sont pas terminaux.
const TERMINAL_STATUSES = new Set<CarcasseStatus>([
  CarcasseStatus.ACCEPTE,
  CarcasseStatus.MANQUANTE_ETG_COLLECTEUR,
  CarcasseStatus.REFUS_ETG_COLLECTEUR,
  CarcasseStatus.MANQUANTE_SVI,
  CarcasseStatus.SAISIE_TOTALE,
  CarcasseStatus.SAISIE_PARTIELLE,
  CarcasseStatus.LEVEE_DE_CONSIGNE,
  CarcasseStatus.TRAITEMENT_ASSAINISSANT,
]);

// Verrouillage "le SVI a explicitement clôturé cette carcasse" (manuel ou cron).
// Plus étroit que isCarcasseDone : exclut les décisions intermédiaires (refus/manquante)
// et les statuts SVI sans clôture explicite. Sert aux gates canEdit / current-owner-confirm
// qui correspondent à l'ancien check `fei.svi_closed_at`.
export function isCarcasseClosedBySvi(carcasse: Carcasse): boolean {
  return !!(carcasse.svi_closed_at || carcasse.svi_automatic_closed_at);
}

export function isCarcasseDone(carcasse: Carcasse): boolean {
  if (carcasse.svi_closed_at || carcasse.svi_automatic_closed_at) return true;
  if (carcasse.intermediaire_closed_at) return true;
  if (carcasse.intermediaire_carcasse_refus_intermediaire_id) return true;
  if (carcasse.intermediaire_carcasse_manquante) return true;
  if (carcasse.consommateur_final_usage_domestique) return true;
  // Circuit court (commerce de détail, particulier…) : destinataire terminal, sans passage SVI
  // ni prise en charge. La carcasse ne progressera plus dès qu'elle lui est transmise — c'est
  // le même critère que celui qui clôture la fiche côté backend (notifyCircuitCourt).
  if (isRoleCircuitCourt(carcasse.next_owner_role) || isRoleCircuitCourt(carcasse.current_owner_role)) {
    return true;
  }
  const status = carcasse.svi_carcasse_status ?? updateCarcasseStatus(carcasse);
  return TERMINAL_STATUSES.has(status);
}

// Une fiche est terminée quand TOUTES ses carcasses sont terminales (multi-destinataire :
// les lots progressent séparément). Source de vérité unique pour le tri des listes
// (get-fei-sorted) ET le libellé "Clôturée" (fei-steps) — ne pas dériver depuis une seule carcasse.
export function isFeiDone(fei: Fei, carcasses: Array<Carcasse>): boolean {
  if (fei.consommateur_final_usage_domestique) return true;
  // Carcasses pas encore chargées : ne pas conclure "done" par vacuité.
  if (carcasses.length === 0) return false;
  return carcasses.every(isCarcasseDone);
}

export function isCarcasseUnderMyResponsability(
  carcasse: Carcasse,
  me: User,
  entitiesWorkingDirectlyFor: Record<EntityWithUserRelation['id'], EntityWithUserRelation>
) {
  // At least one carcasse where current_owner is me/my entity AND no next_owner
  if (carcasse.next_owner_user_id || carcasse.next_owner_entity_id) return false;
  if (carcasse.current_owner_user_id === me.id) return true;
  if (carcasse.current_owner_entity_id && entitiesWorkingDirectlyFor[carcasse.current_owner_entity_id]) {
    return true;
  }
  return false;
}

export function isCarcasseToTake(
  carcasse: Carcasse,
  me: User,
  entitiesWorkingDirectlyFor: Record<EntityWithUserRelation['id'], EntityWithUserRelation>
) {
  if (carcasse.next_owner_user_id === me.id) return true;
  if (carcasse.next_owner_entity_id && entitiesWorkingDirectlyFor[carcasse.next_owner_entity_id]) {
    return true;
  }
  return false;
}
