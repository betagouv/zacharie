// Registre central des templates Brevo.
//
// Chaque entrée correspond à un email envoyé par Zacharie (cf. doc/emails.md).
// La valeur est le `templateId` Brevo, ou `null` tant que le template n'a pas été créé.
//
// C'est le TRACKER DE MIGRATION : tant qu'une valeur est `null`, l'email correspondant
// est encore construit en texte dans le code (via `sendEmail` / `sendNotificationToUser`).
// Une valeur numérique = email migré vers un template Brevo (via `sendTemplateEmail`).
//
// Pour migrer un email : créer le template côté Brevo, renseigner son id ici, puis router
// le call site vers `sendTemplateEmail` avec les `params` attendus par le template.

export type BrevoTemplateKey =
  // 1. Transactionnels (action directe d'un user)
  | 'CONTACT_FORM'
  | 'PASSWORD_RESET'
  | 'USER_INVITATION'
  | 'ONBOARDING_DONE'
  | 'ACCOUNT_ACTIVATED'
  // 2. Notices internes équipe
  | 'INTERNAL_NEW_ACCOUNT'
  | 'INTERNAL_REGISTRATION_DONE'
  | 'INTERNAL_CFEI_CHANGED'
  | 'INTERNAL_ASSO_PREREGISTERED'
  | 'INTERNAL_PARTENAIRE_PREREGISTERED'
  | 'INTERNAL_CCG_PREREGISTERED'
  // 3. Notifications automatiques
  | 'FEI_TRANSMITTED_TO_SVI'
  | 'FEI_ASSIGNED_CIRCUIT_COURT'
  | 'FEI_ASSIGNED_USER'
  | 'FEI_UNASSIGNED'
  | 'FEI_ASSIGNED_ENTITY'
  | 'CARCASSE_SAISIE'
  | 'CARCASSE_MANQUANTE'
  | 'CARCASSE_REFUS'
  | 'FEI_CLOSED'
  | 'FEI_RENVOI_EXPEDITEUR'
  | 'NEW_USER_IN_ENTITY'
  | 'CARCASSE_MODIF_REQUEST_CREATED'
  | 'CARCASSE_MODIF_REQUEST_TREATED'
  // 4. Cron
  | 'FEI_AUTOMATIC_CLOSED'
  | 'RELANCE_PROFIL_INCOMPLET';

export const BrevoTemplateId: Record<BrevoTemplateKey, number | null> = {
  // 1. Transactionnels (action directe d'un user)
  CONTACT_FORM: null,
  PASSWORD_RESET: 75,
  USER_INVITATION: null,
  ONBOARDING_DONE: 76,
  ACCOUNT_ACTIVATED: null,

  // 2. Notices internes équipe (→ contact@zacharie.beta.gouv.fr)
  INTERNAL_NEW_ACCOUNT: null,
  INTERNAL_REGISTRATION_DONE: null,
  INTERNAL_CFEI_CHANGED: null,
  INTERNAL_ASSO_PREREGISTERED: null,
  INTERNAL_PARTENAIRE_PREREGISTERED: null,
  INTERNAL_CCG_PREREGISTERED: null,

  // 3. Notifications automatiques (event-driven, email si préf. EMAIL active)
  FEI_TRANSMITTED_TO_SVI: null,
  FEI_ASSIGNED_CIRCUIT_COURT: null,
  FEI_ASSIGNED_USER: null,
  FEI_UNASSIGNED: null,
  FEI_ASSIGNED_ENTITY: null,
  CARCASSE_SAISIE: null,
  CARCASSE_MANQUANTE: null,
  CARCASSE_REFUS: null,
  FEI_CLOSED: null,
  FEI_RENVOI_EXPEDITEUR: null,
  NEW_USER_IN_ENTITY: null,
  CARCASSE_MODIF_REQUEST_CREATED: null,
  CARCASSE_MODIF_REQUEST_TREATED: null,

  // 4. Cron
  FEI_AUTOMATIC_CLOSED: null,
  RELANCE_PROFIL_INCOMPLET: null,
};
