import { Carcasse, CarcasseStatus } from '@prisma/client';
import updateCarcasseStatus from '~/utils/get-carcasse-status';

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

export function isCarcasseDone(carcasse: Carcasse): boolean {
  if (carcasse.svi_closed_at || carcasse.svi_automatic_closed_at) return true;
  // Circuit court / commerce de détail : clôturée par l'intermédiaire, sans passage SVI.
  if (carcasse.intermediaire_closed_at) return true;
  if (carcasse.intermediaire_carcasse_refus_intermediaire_id) return true;
  if (carcasse.intermediaire_carcasse_manquante) return true;
  if (carcasse.consommateur_final_usage_domestique) return true;
  const status = carcasse.svi_carcasse_status ?? updateCarcasseStatus(carcasse);
  return TERMINAL_STATUSES.has(status);
}
