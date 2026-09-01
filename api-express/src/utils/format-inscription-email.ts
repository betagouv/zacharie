const SIGNATURE = `Cordialement,

L'équipe Zacharie
Ministère de l'Agriculture, de l'Agro-alimentaire et de la Souveraineté alimentaire`;

const SUBJECT = `Votre inscription sur Zacharie (fiches d'examen initial du gibier)`;

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
