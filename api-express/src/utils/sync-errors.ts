// Refus d'autorisation : la version locale du client n'a aucune chance de passer, il doit cesser de
// la repousser. Toute autre erreur reste transitoire et sera réessayée — notamment « Fiche non
// trouvée » / « Carcasse introuvable », qui arrivent légitimement quand la ligne parente du même lot
// vient d'échouer et passera au prochain envoi.
export type SyncRejectedErrorMessage =
  | "Vous n'avez pas accès à cette carcasse"
  | "Vous n'avez pas accès à cette fiche"
  | 'Vous ne pouvez pas agir au nom de cette entité'
  | "Seul l'examinateur initial peut approuver ou refuser une demande"
  | "Seul l'auteur de la demande peut l'annuler"
  | 'Seul un examinateur initial peut créer une fiche'
  | 'Vous ne pouvez pas supprimer cette fiche'
  | 'Version obsolète';

export class SyncRejectedError extends Error {
  constructor(message: SyncRejectedErrorMessage) {
    super(message);
    this.name = 'SyncRejectedError';
  }
}
