export type FeiStep =
  | 'Examen initial'
  | 'Validation par le premier détenteur'
  | "Transport vers l'établissement de traitement"
  | 'Fiche envoyée, pas encore traitée'
  | "Réception par l'établissement de traitement"
  | 'Inspection par le SVI'
  | 'Clôturée';
