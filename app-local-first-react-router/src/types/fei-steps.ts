export type FeiStep =
  | 'En cours'
  | 'Clôturée'
  | 'Examen initial'
  | 'Validation par le premier détenteur'
  | 'Transport'
  | 'Transport vers un établissement de traitement'
  | 'Transport vers un autre établissement de traitement'
  | 'Transport vers / réception par un établissement de traitement'
  | 'Fiche envoyée, pas encore traitée'
  | 'Réception par un établissement de traitement'
  | 'Inspection par le SVI';

export type FeiStepSimpleStatus = 'À compléter' | 'Clôturée' | 'En cours';

export type FeiStepForEtg =
  | 'Fiche reçue, pas encore prise en charge'
  | 'Prise en charge par le transporteur'
  | "Prise en charge par l'atelier"
  | 'Fiche envoyée, pas encore prise en charge'
  | "Prise en charge par le service vétérinaire d'inspection";
