import { Carcasse, CarcasseStatus } from '@prisma/client';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import updateCarcasseStatus from './get-carcasse-status';

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
  if (carcasse.intermediaire_carcasse_refus_intermediaire_id) return true;
  if (carcasse.intermediaire_carcasse_manquante) return true;
  if (carcasse.consommateur_final_usage_domestique) return true;
  const status = carcasse.svi_carcasse_status ?? updateCarcasseStatus(carcasse);
  return TERMINAL_STATUSES.has(status);
}

// Une fiche est terminée quand TOUTES ses carcasses sont terminales (multi-destinataire :
// les lots progressent séparément). Source de vérité unique pour le tri des listes
// (get-fei-sorted) ET le libellé "Clôturée" (fei-steps) — ne pas dériver depuis une seule carcasse.
export function isFeiDone(fei: FeiWithIntermediaires, carcasses: Array<Carcasse>): boolean {
  if (fei.intermediaire_closed_at || fei.consommateur_final_usage_domestique) return true;
  if (fei.automatic_closed_at) return true;
  // Carcasses pas encore chargées : ne pas conclure "done" par vacuité.
  if (carcasses.length === 0) return false;
  return carcasses.every(isCarcasseDone);
}
