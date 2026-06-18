export type TransmissionSimpleStatus = 'À compléter' | 'Clôturée' | 'En cours';

export type TransmissionStepForTransportOrSoustraite = 'Sous-traitée' | 'Transporté' | '';

export type TransmissionStepForEtg =
  | 'Fiche reçue, pas encore prise en charge'
  | 'Prise en charge par le transporteur'
  | "Prise en charge par l'atelier"
  | 'Prise en charge par un autre atelier'
  | 'Fiche envoyée, pas encore prise en charge'
  | 'Transport vers un autre établissement de traitement'
  | 'Inspection par le SVI'
  | 'Inspection vétérinaire terminée'
  | 'Carcasses refusées';

export type TransmissionStepForCollecteurPro =
  | 'Carcasses traitées'
  | 'Fiche reçue, pas encore prise en charge'
  | 'Traitement des carcasses'
  | 'Transport vers un établissement de traitement'
  | 'Transport';

export type TransmissionStepForChasseur =
  | 'Carcasses traitées'
  | 'Prise en charge par le transporteur'
  | `Prise en charge par le transporteur ${string}`
  | 'Information manquante'
  | 'Validation par le premier détenteur'
  | 'Fiche envoyée, pas encore prise en charge'
  | 'Traitement des carcasses';

export type TransmissionStepForSvi = 'Traitement des carcasses' | 'Clôturée';

export type TransmissionStepGeneric = 'Clôturée' | 'En cours';

export type TransmissionStep =
  | TransmissionStepForEtg
  | TransmissionStepForChasseur
  | TransmissionStepForCollecteurPro
  | TransmissionStepForCollecteurPro
  | TransmissionStepForSvi
  | TransmissionStepGeneric;

export type TransmissionNextStep =
  | 'Réception par un établissement de traitement'
  | 'Validation par le premier détenteur'
  | 'Traitement des carcasses'
  | 'Clôturée';
