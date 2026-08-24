// Refus d'autorisation : la version locale du client n'a aucune chance de passer, il doit cesser de
// la repousser. Toute autre erreur reste transitoire et sera réessayée — notamment « Fiche non
// trouvée » / « Carcasse introuvable », qui arrivent légitimement quand la ligne parente du même lot
// vient d'échouer et passera au prochain envoi.
export class SyncRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncRejectedError';
  }
}
