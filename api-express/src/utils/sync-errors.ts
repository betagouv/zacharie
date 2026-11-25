export type SyncRejectedErrorMessage =
  | "Vous n'avez pas accès à cette carcasse"
  | "Vous n'avez pas accès à cette fiche"
  | "Cette carcasse n'appartient pas à cette fiche"
  | 'Vous ne pouvez pas agir au nom de cette entité'
  | "Seul l'examinateur initial peut approuver ou refuser une demande"
  | "Seul l'auteur de la demande peut l'annuler"
  | 'Type de demande inconnu'
  | "Vous ne pouvez déclarer comme ajoutée qu'une carcasse que vous avez créée"
  | 'Seul un examinateur initial peut créer une fiche'
  | 'Vous ne pouvez pas supprimer cette fiche'
  | 'Vous ne pouvez pas supprimer cette carcasse'
  | 'Cette entité a été supprimée, choisissez-en une autre'
  | 'Version obsolète';

export class SyncRejectedError extends Error {
  constructor(message: SyncRejectedErrorMessage) {
    super(message);
    this.name = 'SyncRejectedError';
  }
}
