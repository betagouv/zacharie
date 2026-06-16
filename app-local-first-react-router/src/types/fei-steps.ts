export type FeiStep =
  | 'En cours'
  | 'Clôturée'
  | 'Traitement des carcasses'
  | 'Examen initial'
  | 'Validation par le premier détenteur'
  | 'Transport'
  | 'Transport vers un établissement de traitement'
  | 'Transport vers un autre établissement de traitement'
  | 'Transport vers / réception par un établissement de traitement'
  | 'Fiche envoyée, pas encore traitée'
  | 'Réception par un établissement de traitement'
  | 'Inspection par le SVI'
  | 'Carcasses traitées';

export type FeiStepSimpleStatus = 'À compléter' | 'Clôturée' | 'En cours';

export type FeiStepForEtg =
  | 'Fiche reçue, pas encore prise en charge'
  | 'Prise en charge par le transporteur'
  | "Prise en charge par l'atelier"
  | 'Prise en charge par un autre atelier'
  | 'Fiche envoyée, pas encore prise en charge'
  | 'Transport vers un autre établissement de traitement'
  | 'Inspection vétérinaire terminée';

export type FeiStepForTransportOrSoustraite = 'Sous-traitée' | 'Transporté' | '';

export type FeiStepForChasseur =
  | 'Carcasses traitées'
  | 'Prise en charge par le transporteur'
  | `Prise en charge par le transporteur ${string}`
  | 'Information manquante'
  | 'Validation par le premier détenteur'
  | 'Fiche envoyée, pas encore prise en charge'
  | 'Traitement des carcasses';
