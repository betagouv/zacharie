// Libellés des actions du journal admin (AdminAuditLog.action = méthode + route)
const ADMIN_ACTION_LABELS: Record<string, string> = {
  'POST /user/connect-as': 'Connexion en tant que',
  'POST /user/nouveau': 'Création d’utilisateur',
  'POST /user/:user_id': 'Modification d’utilisateur',
  'POST /user/:user_id/soft-delete': 'Suppression d’utilisateur',
  'POST /user/:user_id/restore': 'Restauration d’utilisateur',
  'POST /user/:user_id/unblock': 'Déblocage de la connexion',
  'POST /user/:user_id/invitation-link': 'Lien d’invitation généré',
  'POST /user/:user_id/send-reset-password': 'Réinitialisation du mot de passe envoyée',
  'POST /user-entity': 'Rattachement à une entité',
  'PUT /user-entity': 'Changement de statut dans une entité',
  'DELETE /user-entity': 'Retrait d’une entité',
  'POST /entity/nouvelle': 'Création d’entité',
  'POST /entity/:entity_id': 'Modification d’entité',
  'POST /entity/:entity_id/soft-delete': 'Suppression d’entité',
  'POST /entity/:entity_id/restore': 'Restauration d’entité',
  'POST /entity-dedicated-api-key/:entity_id': 'Clé API dédiée à une entité',
  'POST /fei/:fei_numero/soft-delete': 'Suppression de fiche',
  'POST /carcasse/:zacharie_carcasse_id/soft-delete': 'Suppression de carcasse',
  'POST /fei/:fei_numero/corrections': 'Correction de fiche',
  'POST /fei/:fei_numero/carcasse': 'Ajout de carcasse',
  'POST /api-key/nouvelle': 'Création de clé API',
  'POST /api-key/new-access-token/:id': 'Nouveau jeton de clé API',
  'POST /api-key-approval': 'Approbation de clé API',
  'POST /ccg/import': 'Import de CCG',
  'POST /bug-resolution': 'Nouvelle enquête de bug',
  'POST /bug-resolution/:id/message': 'Message à Albert',
};

export function adminActionLabel(action: string) {
  return ADMIN_ACTION_LABELS[action] ?? action;
}
