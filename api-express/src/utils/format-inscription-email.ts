const SIGNATURE = `Cordialement,

L'équipe Zacharie
Ministère de l'Agriculture, de l'Agro-alimentaire et de la Souveraineté alimentaire`;

const SUBJECT = `Votre inscription sur Zacharie (fiches d'examen initial du gibier)`;

// Mail de fin d'onboarding — envoyé à tout utilisateur dès que son inscription est terminée.
// Le compte n'est pas activé automatiquement : il attend une validation manuelle sous 48h.
export function formatInscriptionEnExamenEmail(): { subject: string; text: string } {
  const text = [
    `Bonjour,`,
    `Nous vous remercions pour votre inscription sur Zacharie (fiches d'examen initial du gibier).`,
    `Votre inscription sera examinée sous 48 heures.\nSans réponse de notre part dans ce délai, nous vous invitons à nous contacter par email ou par téléphone au 01 89 31 66 40.`,
    SIGNATURE,
  ].join('\n\n');
  return { subject: SUBJECT, text };
}

// Mail « compte activé » — envoyé une seule fois par compte, à la première activation
// (auto-activation premier détenteur ou validation manuelle admin).
export function formatCompteActiveEmail(): { subject: string; text: string } {
  const text = [
    `Bonjour,`,
    `Votre compte Zacharie a été activé, vous pouvez désormais accéder à l'application en cliquant sur le lien suivant: https://zacharie.beta.gouv.fr/app/connexion`,
    "Attention : pour l'instant, seuls certains collecteurs et ateliers de traitement du gibier acceptent des fiches en format numérique. En cas de doute, merci de contacter le destinataire de vos carcasses avant de créer votre première fiche numérique.",
    `N'hésitez pas à nous contacter,`,
    `L'équipe Zacharie`,
    `Ce message a été généré automatiquement par l'application Zacharie. Si c'est une erreur, veuillez ignorer ce message.`,
  ].join('\n\n');
  return { subject: 'Votre compte Zacharie a été activé', text };
}

// Email B — relance unique envoyée au chasseur qui a créé son compte mais n'a pas terminé
// son inscription (profil incomplet). Lien vers le point d'entrée de l'onboarding.
export function formatRelanceProfilIncompletEmail(): { subject: string; text: string } {
  const url = 'https://zacharie.beta.gouv.fr/app/chasseur/onboarding/mes-coordonnees';
  const text = [
    `Bonjour,`,
    `Nous vous remercions pour votre inscription sur Zacharie (fiches d'examen initial du gibier).`,
    `Afin de valider votre compte, nous vous invitons à compléter votre profil : ${url}`,
    `Pour toute question, n'hésitez pas à nous contacter par mail ou par téléphone au 01 89 31 66 40.`,
    SIGNATURE,
  ].join('\n\n');
  return { subject: SUBJECT, text };
}
