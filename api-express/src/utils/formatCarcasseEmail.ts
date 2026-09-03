import {
  Carcasse,
  CarcasseStatus,
  CarcasseType,
  Fei,
  FeiOwnerRole,
  IPM2Decision,
  User,
  UserRoles,
} from '@prisma/client';
import { getCarcasseStatusLabelForEmail } from './get-carcasse-status';
import lesions from '../assets/lesions.json';
import prisma from '~/prisma';
import { getCircuitCourtFeiUrl, getFeiUrlForRole } from './fei-url';
import { VITE_APP_URL } from '~/config';

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
    return `${vulgarisation} (${complement.toLowerCase()})`;
  }
  if (vulgarisation) {
    return vulgarisation;
  }
  return motif;
}

export async function formatCarcasseChasseurEmail(carcasse: Carcasse) {
  if (
    carcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE ||
    carcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE
  ) {
    const email = [
      `Carcasse de ${carcasse.espece}`,
      `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
      `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
      `Décision du service vétérinaire\u00A0: ${getCarcasseStatusLabelForEmail(carcasse)}`,
      `Motifs de saisie\u00A0:\n${carcasse.svi_ipm2_lesions_ou_motifs.map((motif) => ` -> ${getMotifForChasseur(motif, carcasse.type)}`).join('\n')}`,
      carcasse.svi_carcasse_commentaire ? `Commentaire\u00A0:\n${carcasse.svi_carcasse_commentaire}` : null,
      `Rendez-vous sur Zacharie pour consulter le détail de la carcasse : https://zacharie.beta.gouv.fr/app/chasseur/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
    ];
    return email.filter(Boolean).join('\n');
  }
  if (carcasse.intermediaire_carcasse_manquante) {
    const email = [
      `Carcasse de ${carcasse.espece} : Manquante`,
      `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
      `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
      `Rendez-vous sur Zacharie pour consulter le détail de la fiche : https://zacharie.beta.gouv.fr/app/chasseur/fei/${carcasse.fei_numero}`,
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
      `Rendez-vous sur Zacharie pour consulter le détail de la fiche : https://zacharie.beta.gouv.fr/app/chasseur/fei/${carcasse.fei_numero}`,
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

export type CarcasseSaisieTemplateParams = {
  saisie_label: string;
  saisie_label_capitalized: string;
  carcasse_label: string;
  espece: string;
  numero_bracelet: string;
  motifs: string[];
  commentaire: string | null;
  cta: string;
};

// L'email part en template Brevo, le push reste en texte : les deux sont dérivés des mêmes `params`
// pour ne pas diverger. Les accords (carcasse / lot de carcasses) sont résolus ici, pas dans le
// template : Brevo n'a pas à connaître `CarcasseType`.
export function formatSaisieChasseurEmail(carcasse: Carcasse): {
  object: string;
  text: string;
  params: CarcasseSaisieTemplateParams;
} {
  const saisieLabel = getCarcasseStatusLabelForEmail(carcasse).toLowerCase();
  const params: CarcasseSaisieTemplateParams = {
    saisie_label: saisieLabel,
    saisie_label_capitalized: saisieLabel.charAt(0).toUpperCase() + saisieLabel.slice(1),
    carcasse_label: carcasse.type === CarcasseType.GROS_GIBIER ? 'de la carcasse' : 'du lot de carcasses',
    espece: carcasse.espece.toLowerCase(),
    numero_bracelet: carcasse.numero_bracelet,
    motifs: carcasse.svi_ipm2_lesions_ou_motifs.map((motif) => getMotifForChasseur(motif, carcasse.type)),
    commentaire: carcasse.svi_carcasse_commentaire || null,
    cta: `${VITE_APP_URL}/app/chasseur/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
  };

  const object = `${params.saisie_label_capitalized} ${params.carcasse_label} de ${params.espece} n°${params.numero_bracelet}.`;
  const text = [
    `Bonjour,`,
    `Le service vétérinaire d’inspection a décidé la ${params.saisie_label} ${params.carcasse_label} de ${params.espece} n°${params.numero_bracelet}.`,
    `Motif${params.motifs.length > 1 ? 's' : ''} de la saisie:\n${params.motifs.map((motif) => `-> ${motif}`).join('\n')}`,
    params.commentaire ? `Commentaire du service vétérinaire:\n${params.commentaire}` : null,
    `Pour consulter les détails de cette carcasse, rendez-vous sur Zacharie : ${params.cta}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur cette saisie, merci de contacter l’établissement où a été effectuée l’inspection.`,
  ];

  return { object, text: text.filter(Boolean).join('\n\n'), params };
}

// Manquante et refus sont constatés par le même intermédiaire : mêmes infos à charger, deux emails
// distincts derrière (constat de manque vs refus motivé).
async function getIntermediaireConstat(carcasse: Carcasse) {
  const carcasseIntermediaire = await prisma.carcasseIntermediaire.findUnique({
    where: {
      fei_numero_zacharie_carcasse_id_intermediaire_id: {
        fei_numero: carcasse.fei_numero,
        zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
        intermediaire_id: carcasse.intermediaire_carcasse_refus_intermediaire_id!,
      },
    },
    select: {
      commentaire: true,
      CarcasseIntermediaireEntity: {
        select: {
          nom_d_usage: true,
        },
      },
    },
  });
  const carcasseLabel = carcasse.type === CarcasseType.GROS_GIBIER ? 'La carcasse' : 'Le lot de carcasses';
  const carcasseLabelCapitalized = carcasseLabel.charAt(0).toUpperCase() + carcasseLabel.slice(1);

  return {
    entity_name: carcasseIntermediaire?.CarcasseIntermediaireEntity.nom_d_usage,
    commentaire: carcasseIntermediaire?.commentaire || null,
    espece: carcasse.espece.toLowerCase(),
    numero_bracelet: carcasse.numero_bracelet,
    carcasse_label: carcasseLabel.toLowerCase(),
    carcasse_label_capitalized: carcasseLabelCapitalized,
    cta: `${VITE_APP_URL}/app/chasseur/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
  };
}

export type CarcasseManquanteTemplateParams = {
  entity_name: string;
  carcasse_label: string;
  carcasse_label_capitalized: string;
  manquante_label: string;
  espece: string;
  numero_bracelet: string;
  commentaire: string | null;
  cta: string;
};

export async function formatCarcasseManquanteChasseurEmail(carcasse: Carcasse): Promise<{
  object: string;
  text: string;
  params: CarcasseManquanteTemplateParams;
}> {
  const constat = await getIntermediaireConstat(carcasse);
  const params: CarcasseManquanteTemplateParams = {
    ...constat,
    manquante_label: carcasse.type === CarcasseType.GROS_GIBIER ? 'manquante' : 'manquant',
  };

  const object = `${params.carcasse_label_capitalized} de ${params.espece} n°${params.numero_bracelet} est ${params.manquante_label}.`;
  const text = [
    `Bonjour,`,
    `${params.entity_name} a constaté que ${params.carcasse_label.toLowerCase()} de ${params.espece} n°${params.numero_bracelet} était ${params.manquante_label}.`,
    params.commentaire ? `Commentaire de ${params.entity_name} :\n${params.commentaire}` : null,
    `Pour consulter les détails de cette carcasse, rendez-vous sur Zacharie : ${params.cta}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur ce constat, merci de contacter l’organisme qui a constaté ce manque.`,
  ];

  return { object, text: text.filter(Boolean).join('\n\n'), params };
}

export type CarcasseRefusTemplateParams = {
  entity_name: string;
  carcasse_label: string;
  carcasse_label_capitalized: string;
  refus_label: string;
  espece: string;
  numero_bracelet: string;
  motif: string | null;
  commentaire: string | null;
  cta: string;
};

export async function formatCarcasseRefusChasseurEmail(carcasse: Carcasse): Promise<{
  object: string;
  text: string;
  params: CarcasseRefusTemplateParams;
}> {
  const constat = await getIntermediaireConstat(carcasse);
  const params: CarcasseRefusTemplateParams = {
    ...constat,
    refus_label: carcasse.type === CarcasseType.GROS_GIBIER ? 'refusée' : 'refusé',
    motif: carcasse.intermediaire_carcasse_refus_motif || null,
  };

  const object = `${params.carcasse_label_capitalized} de ${params.espece} n°${params.numero_bracelet} est ${params.refus_label}.`;
  const text = [
    `Bonjour,`,
    `${params.entity_name} a refusé ${params.carcasse_label.toLowerCase()} de ${params.espece} n°${params.numero_bracelet}.`,
    params.motif ? `Motif de refus :\n${params.motif}` : null,
    params.commentaire ? `Commentaire de ${params.entity_name} :\n${params.commentaire}` : null,
    `Pour consulter les détails de cette carcasse, rendez-vous sur Zacharie : ${params.cta}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur ce constat, merci de contacter l’organisme qui a constaté ce manque.`,
  ];

  return { object, text: text.filter(Boolean).join('\n\n'), params };
}

export function formatRenvoiExpediteurEmail(
  fei: Fei,
  expediteurRole: FeiOwnerRole,
  renvoyeurName: string | null,
  premierDetenteurProchainDetenteurIdCache: string | null
): [string, string] {
  const url =
    expediteurRole === FeiOwnerRole.COLLECTEUR_PRO
      ? `https://zacharie.beta.gouv.fr/app/collecteur/fei/${fei.numero}/${premierDetenteurProchainDetenteurIdCache}`
      : `https://zacharie.beta.gouv.fr/app/chasseur/fei/${fei.numero}`;

  const renvoyeur = renvoyeurName ?? 'Le destinataire';

  const email = [
    `Bonjour,`,
    `${renvoyeur} a renvoyé la fiche ${fei.numero} : vous devez choisir un autre destinataire pour cette fiche.`,
    `Pour consulter la fiche, rendez-vous sur Zacharie : ${url}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur ce renvoi, merci de contacter l’établissement qui vous a renvoyé la fiche.`,
  ];

  const object = `La fiche ${fei.numero} vous a été renvoyée.`;
  return [object, email.filter(Boolean).join('\n\n')];
}

export async function formatAutomaticClosingEmailForChasseur(
  fei_numero: Fei['numero'],
  carcasses: Carcasse[]
): Promise<[string, string]> {
  let numberOfValidatedCarcasses = 0;
  let numberOfRefusedCarcasses = 0;
  for (const carcasse of carcasses) {
    switch (carcasse.svi_carcasse_status) {
      case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR:
      case CarcasseStatus.REFUS_ETG_COLLECTEUR:
      case CarcasseStatus.SAISIE_TOTALE:
      case CarcasseStatus.CONSIGNE: {
        numberOfRefusedCarcasses++;
        break;
      }
      default:
      case CarcasseStatus.SANS_DECISION:
      case CarcasseStatus.ACCEPTE:
      case CarcasseStatus.MANQUANTE_SVI:
      case CarcasseStatus.SAISIE_PARTIELLE:
      case CarcasseStatus.LEVEE_DE_CONSIGNE:
      case CarcasseStatus.TRAITEMENT_ASSAINISSANT:
        numberOfValidatedCarcasses++;
        break;
    }
  }

  const email = [
    `Bonjour,`,
    `La fiche ${fei_numero} a été réceptionnée par le Service Vétérinaire il y a plus de 10 jours, elle est donc automatiquement clôturée.`,
    `Bilan de cette fiche:`,
    `- ${numberOfValidatedCarcasses} carcasses ont été acceptées`,
    `- ${numberOfRefusedCarcasses} carcasses ont été refusées`,
    `Pour consulter le détail de la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/chasseur/fei/${fei_numero}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur des saisies ou refus, merci de contacter l’établissement qui a traité votre fiche.`,
  ];

  const object = `La fiche ${fei_numero} est clôturée.`;
  return [object, email.filter(Boolean).join('\n\n')];
}

export async function formatManualValidationSviChasseurEmail(
  fei_numero: Fei['numero'],
  carcasses: Carcasse[]
): Promise<[string, string]> {
  let numberOfValidatedCarcasses = 0;
  let numberOfRefusedCarcasses = 0;
  for (const carcasse of carcasses) {
    switch (carcasse.svi_carcasse_status) {
      case CarcasseStatus.MANQUANTE_ETG_COLLECTEUR:
      case CarcasseStatus.REFUS_ETG_COLLECTEUR:
      case CarcasseStatus.SAISIE_TOTALE:
      case CarcasseStatus.CONSIGNE: {
        numberOfRefusedCarcasses++;
        break;
      }
      default:
      case CarcasseStatus.SANS_DECISION:
      case CarcasseStatus.ACCEPTE:
      case CarcasseStatus.MANQUANTE_SVI:
      case CarcasseStatus.SAISIE_PARTIELLE:
      case CarcasseStatus.LEVEE_DE_CONSIGNE:
      case CarcasseStatus.TRAITEMENT_ASSAINISSANT:
        numberOfValidatedCarcasses++;
        break;
    }
  }

  const email = [
    `Bonjour,`,
    `La fiche ${fei_numero} a été prise en charge et traitée par le Service Vétérinaire`,
    `Bilan de cette fiche:`,
    `- ${numberOfValidatedCarcasses} carcasses ont été acceptées`,
    `- ${numberOfRefusedCarcasses} carcasses ont été refusées`,
    `Pour consulter le détail de la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/chasseur/fei/${fei_numero}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur des saisies ou refus, merci de contacter l’établissement qui a traité votre fiche.`,
  ];

  const object = `La fiche ${fei_numero} est clôturée.`;
  return [object, email.filter(Boolean).join('\n\n')];
}

// Params du template Brevo FEI_TRANSMITTED_TO_SVI (placeholders {{ params.xxx }}).
export type SviAssignedTemplateParams = {
  entity_name: string;
  count: number;
  carcasses: string[];
  cta: string;
};

// L'email SVI part en template Brevo, le push reste en texte : les deux sont dérivés des mêmes
// `params` pour ne pas diverger, et les requêtes ne sont faites qu'une fois (le side-effect appelant
// tourne une fois par carcasse de la fiche).
export async function formatSviAssignedEmail(
  carcasse: Carcasse
): Promise<{ object: string; text: string; params: SviAssignedTemplateParams }> {
  const currentEntity = await prisma.entity.findUnique({
    where: {
      id: carcasse.current_owner_entity_id,
      deleted_at: null,
    },
  });
  const feiCarcasses = await prisma.carcasse.findMany({
    where: {
      fei_numero: carcasse.fei_numero,
      premier_detenteur_prochain_detenteur_id_cache: carcasse.premier_detenteur_prochain_detenteur_id_cache,
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_intermediaire_id: null,
      deleted_at: null,
      svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    },
    orderBy: {
      numero_bracelet: 'asc',
    },
  });

  // le SVI consulte une transmission (fiche + prochain détenteur du premier détenteur), pas la fiche seule
  const prochainDetenteurIdCache = feiCarcasses[0]?.premier_detenteur_prochain_detenteur_id_cache;
  const transmissionLink = prochainDetenteurIdCache
    ? `${carcasse.fei_numero}/${prochainDetenteurIdCache}`
    : carcasse.fei_numero;

  const params: SviAssignedTemplateParams = {
    entity_name: currentEntity?.nom_d_usage,
    count: feiCarcasses.length,
    carcasses: feiCarcasses.map(
      (carcasse) =>
        `${carcasse.type === CarcasseType.PETIT_GIBIER ? `${carcasse.nombre_d_animaux} ` : ''}${carcasse.espece} (${carcasse.numero_bracelet})`
    ),
    cta: `https://zacharie.beta.gouv.fr/app/svi/fei/${transmissionLink}`,
  };

  const object = `L’établissement ${params.entity_name} vous a transmis une fiche comprenant ${params.count} carcasses (ou lots) à inspecter:`;
  const text = [
    `Bonjour,`,
    object,
    params.carcasses.map((carcasse) => `-> ${carcasse}`).join('\n'),
    `Pour consulter la fiche, rendez-vous sur Zacharie : ${params.cta}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, merci de contacter l’établissement qui a traité votre fiche.`,
  ];
  return { object, text: text.filter(Boolean).join('\n\n'), params };
}

// Attribution d'une fiche à un user, ou aux users d'une entité : même template des deux côtés,
// seul le rôle du destinataire change le lien.
export function formatFeiAssignedTemplateEmail(
  carcasse: Carcasse,
  sender: User,
  recipientRole: UserRoles | undefined
): { sender_name: string; fei_numero: string; cta: string } {
  return {
    sender_name: `${sender.prenom} ${sender.nom_de_famille}`,
    fei_numero: carcasse.fei_numero,
    cta: getFeiUrlForRole(
      recipientRole,
      carcasse.fei_numero,
      carcasse.premier_detenteur_prochain_detenteur_id_cache
    ),
  };
}

// `recipient_email` sert à rappeler au destinataire avec quel compte se connecter.
export function formatCircuitCourtAssignedTemplateEmail(
  carcasse: Carcasse,
  sender: User,
  recipientEmail: string
): { sender_name: string; fei_numero: string; recipient_email: string; cta: string } {
  return {
    sender_name: `${sender.prenom} ${sender.nom_de_famille}`,
    fei_numero: carcasse.fei_numero,
    recipient_email: recipientEmail,
    cta: getCircuitCourtFeiUrl(carcasse.fei_numero, carcasse.premier_detenteur_prochain_detenteur_id_cache),
  };
}

// Fiche attribuée par erreur puis retirée : pas de lien, la fiche n'est plus accessible.
export function formatFeiUnassignedTemplateEmail(
  carcasse: Carcasse,
  sender: User
): { sender_name: string; fei_numero: string } {
  return {
    sender_name: `${sender.prenom} ${sender.nom_de_famille}`,
    fei_numero: carcasse.fei_numero,
  };
}
