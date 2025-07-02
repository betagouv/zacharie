export type FeiStep =
  | 'Clôturée'
  | 'Examen initial'
  | 'Validation par le premier détenteur'
  | 'Inspection par le SVI'
  | 'Fiche envoyée, pas encore traitée'
  | 'Réception par un établissement de traitement'
  | 'Transport vers un établissement de traitement'
  | 'Transport vers / réception par un établissement de traitement'
  | 'Transport'
  | 'Réception par un établissement de traitement'
  | 'Transport vers un autre établissement de traitement';

export type FeiStepSimpleStatus = 'À compléter' | 'Clôturée' | 'En cours';
