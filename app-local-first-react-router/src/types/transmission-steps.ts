// « Dépôt en chambre froide » : fiche lue comme propriétaire du CCG, sans le statut des carcasses
export type TransmissionSimpleStatus = 'À compléter' | 'Clôturée' | 'En cours' | 'Dépôt en chambre froide';

export type TransmissionStepForTransportOrSoustraite = 'Sous-traitée' | 'Transporté' | '';

export type TransmissionStepForEtg =
  | 'Fiche reçue, pas encore prise en charge'
  | 'Prise en charge par le transporteur'
  | "En attente de prise en charge par l'atelier"
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
  | 'Fiche envoyée, pas encore prise en charge'
  | 'Transport';

export type TransmissionStepForChasseur =
  | 'Examen initial'
  | 'Choix des destinataires'
  | 'Traitement des carcasses'
  | 'Carcasses traitées';

export type TransmissionStepForSvi = 'Traitement des carcasses' | 'Clôturée';

export type TransmissionStepGeneric = 'Clôturée' | 'En cours' | 'Dépôt en chambre froide';

export type TransmissionStep =
  | TransmissionStepForEtg
  | TransmissionStepForChasseur
  | TransmissionStepForCollecteurPro
  | TransmissionStepForCollecteurPro
  | TransmissionStepForSvi
  | TransmissionStepGeneric;

export type TransmissionNextStep =
  | 'Réception par un établissement de traitement'
  | 'Choix des destinataires'
  | 'Traitement des carcasses'
  | 'Clôturée';
