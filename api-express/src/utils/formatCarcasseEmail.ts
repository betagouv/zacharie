import { Carcasse, CarcasseStatus, CarcasseType, IPM2Decision } from '@prisma/client';
import { getCarcasseStatusLabelForEmail } from './get-carcasse-status';
import lesions from '../assets/lesions.json';

function getMotifForChasseur(motif: string, carcasseType: CarcasseType) {
  const lesion = lesions[carcasseType]
    .map((l) => {
      return {
        ...l,
        'MOTIVATION EN FAIT (CERTIFICAT) + CODE ZACHARIE': `${l['CODE ZACHARIE']}. ${l['MOTIVATION EN FAIT (CERTIFICAT)']}`,
      };
    })
    .find((l) => {
      if (l['MOTIVATION EN FAIT (CERTIFICAT) + CODE ZACHARIE'] === motif) return true;
      if (l['MOTIVATION EN FAIT (CERTIFICAT)'] === motif) return true;
      return false;
    });
  if (!lesion) {
    return motif;
  }
  const vulgarisation = lesion['VULGARISATION POUR PREMIER DÉTENTEUR ET EXAMINATEUR INITIAL'];
  const complement = lesion["COMPLEMENTS D'INFORMATION POUR 1ER DETENTEUR ET EXAMINATEUR INITIAL"];
  if (vulgarisation && complement) {
    return `${vulgarisation} (${complement})`;
  }
  if (vulgarisation) {
    return vulgarisation;
  }
  return motif;
}

export function formatCarcasseChasseurEmail(carcasse: Carcasse) {
  if (
    carcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE ||
    carcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE
  ) {
    const email = [
      `Carcasse de ${carcasse.espece}`,
      `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
      `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
      `Décision du service vétérinaire\u00A0: ${getCarcasseStatusLabelForEmail(carcasse)}`,
      `Motifs de saisie\u00A0:\n${carcasse.svi_ipm2_lesions_ou_motifs
        .map((motif) => ` -> ${getMotifForChasseur(motif, carcasse.type)}`)
        .join('\n')}`,
      carcasse.svi_carcasse_commentaire ? `Commentaire\u00A0:\n${carcasse.svi_carcasse_commentaire}` : null,
      `Rendez-vous sur Zacharie pour consulter le détail de la carcasse : https://zacharie.beta.gouv.fr/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
    ];
    return email.filter(Boolean).join('\n');
  }
  if (carcasse.intermediaire_carcasse_manquante) {
    const email = [
      `Carcasse de ${carcasse.espece} : Manquante`,
      `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
      `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
      `Rendez-vous sur Zacharie pour consulter le détail de la fiche : https://zacharie.beta.gouv.fr/app/tableau-de-bord/${carcasse.fei_numero}`,
    ];
    return email.filter(Boolean).join('\n');
  }

  if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
    const email = [
      `Carcasse de ${carcasse.espece}`,
      `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
      `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
      `Motif de refus\u00A0: ${carcasse.intermediaire_carcasse_refus_motif}`,
      carcasse.svi_carcasse_commentaire ? `Commentaire\u00A0:\n${carcasse.svi_carcasse_commentaire}` : null,
      `Rendez-vous sur Zacharie pour consulter le détail de la fiche : https://zacharie.beta.gouv.fr/app/tableau-de-bord/${carcasse.fei_numero}`,
    ].filter(Boolean);
    return email.filter(Boolean).join('\n');
  }

  const email = [
    `Carcasse de ${carcasse.espece}`,
    `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
    `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
    `Acceptée par le Service Vétérinaire`,
    carcasse.svi_carcasse_commentaire ? `Commentaire\u00A0:\n${carcasse.svi_carcasse_commentaire}` : null,
  ];
  return email.filter(Boolean).join('\n');
}

export function formatSaisieEmail(carcasse: Carcasse) {
  const saisieLabel = getCarcasseStatusLabelForEmail(carcasse).toLowerCase();
  const url = `https://zacharie.beta.gouv.fr/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`;
  const motifs = carcasse.svi_ipm2_lesions_ou_motifs
    .map((motif) => `-> ${getMotifForChasseur(motif, carcasse.type)}`)
    .join('\n');

  const email = [
    `Bonjour,`,
    `Le service vétérinaire d’inspection a décidé la ${saisieLabel} de la carcasse de ${carcasse.espece} n°${carcasse.numero_bracelet}.`,
    `Motif${motifs ? 's' : ''} de la saisie:\n${motifs}`,
    carcasse.svi_carcasse_commentaire
      ? `Commentaire du service vétérinaire:\n${carcasse.svi_carcasse_commentaire}`
      : null,
    `Pour consulter les détails de cette carcasse, rendez-vous sur Zacharie : ${url}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur cette saisie, merci de contacter l’établissement où a été effectuée l’inspection.`,
  ];
  return email.filter(Boolean).join('\n\n');
}
