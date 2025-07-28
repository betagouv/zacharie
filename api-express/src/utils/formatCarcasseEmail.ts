import { Carcasse, CarcasseStatus, CarcasseType, Fei, IPM2Decision } from '@prisma/client';
import { getCarcasseStatusLabelForEmail } from './get-carcasse-status';
import lesions from '../assets/lesions.json';
import prisma from '~/prisma';
import { formatCountCarcasseByEspece } from './count-carcasses';

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

export function formatSaisieEmail(carcasse: Carcasse): [string, string] {
  const saisieLabel = getCarcasseStatusLabelForEmail(carcasse).toLowerCase();
  const url = `https://zacharie.beta.gouv.fr/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`;
  const motifs = carcasse.svi_ipm2_lesions_ou_motifs
    .map((motif) => `-> ${getMotifForChasseur(motif, carcasse.type)}`)
    .join('\n');

  const carcasseLabel = carcasse.type === CarcasseType.GROS_GIBIER ? 'de la carcasse' : 'du lot de carcasses';
  const email = [
    `Bonjour,`,
    `Le service vétérinaire d’inspection a décidé la ${saisieLabel} ${carcasseLabel} de ${carcasse.espece.toLowerCase()} n°${
      carcasse.numero_bracelet
    }.`,
    `Motif${motifs ? 's' : ''} de la saisie:\n${motifs}`,
    carcasse.svi_carcasse_commentaire
      ? `Commentaire du service vétérinaire:\n${carcasse.svi_carcasse_commentaire}`
      : null,
    `Pour consulter les détails de cette carcasse, rendez-vous sur Zacharie : ${url}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur cette saisie, merci de contacter l’établissement où a été effectuée l’inspection.`,
  ];

  const object = `${saisieLabel} ${carcasseLabel} de ${carcasse.espece.toLowerCase()} n°${
    carcasse.numero_bracelet
  }.`;
  return [object, email.filter(Boolean).join('\n\n')];
}

export async function formatCarcasseManquanteEmail(carcasse: Carcasse): Promise<[string, string]> {
  /* 
  Bonjour,

{nom de l’entité} a constaté que la carcasse de {espèce) n°{numéro d’identification} était manquante.

Commentaire de {nom de l’entité} :
{commentaires}

Pour consulter les détails de cette carcasse, rendez-vous sur Zacharie :
{URL page carcasse}

Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur ce constat, merci de contacter l’organisme qui a constaté ce manque.
  */
  const entite = await prisma.carcasseIntermediaire
    .findUnique({
      where: {
        fei_numero_zacharie_carcasse_id_intermediaire_id: {
          fei_numero: carcasse.fei_numero,
          zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
          intermediaire_id: carcasse.intermediaire_carcasse_refus_intermediaire_id!,
        },
      },
      include: {
        CarcasseIntermediaireEntity: true,
      },
    })
    .then((intermedaire) => {
      return intermedaire!.CarcasseIntermediaireEntity;
    });
  const url = `https://zacharie.beta.gouv.fr/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`;

  const carcasseLabel = carcasse.type === CarcasseType.GROS_GIBIER ? 'La carcasse' : 'Le lot de carcasses';
  const manquanteLabel = carcasse.type === CarcasseType.GROS_GIBIER ? 'manquante' : 'manquant';

  const email = [
    `Bonjour,`,
    `${
      entite?.nom_d_usage
    } a constaté que ${carcasseLabel.toLowerCase()} de ${carcasse.espece.toLowerCase()} n°${
      carcasse.numero_bracelet
    } était ${manquanteLabel}.`,
    carcasse.intermediaire_carcasse_refus_motif
      ? `Commentaire de ${entite?.nom_d_usage} :\n${carcasse.intermediaire_carcasse_refus_motif}`
      : null,
    `Pour consulter les détails de cette carcasse, rendez-vous sur Zacharie : ${url}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur ce constat, merci de contacter l’organisme qui a constaté ce manque.`,
  ];

  const object = `${carcasseLabel} de ${carcasse.espece.toLowerCase()} n°${
    carcasse.numero_bracelet
  } est ${manquanteLabel}.`;
  return [object, email.filter(Boolean).join('\n\n')];
}

export async function formatSviAssignedEmail(fei: Fei): Promise<[string, string]> {
  const currentEntity = await prisma.entity.findUnique({
    where: {
      id: fei.fei_current_owner_entity_id,
    },
  });
  const feiCarcasses = await prisma.carcasse.findMany({
    where: {
      fei_numero: fei.numero,
      intermediaire_carcasse_manquante: false,
      intermediaire_carcasse_refus_intermediaire_id: null,
      deleted_at: null,
      svi_carcasse_status: CarcasseStatus.SANS_DECISION,
    },
    orderBy: {
      numero_bracelet: 'asc',
    },
  });

  const email = [
    `Bonjour,`,
    `L’établissement ${currentEntity?.nom_d_usage} vous a transmis une fiche comprenant ${feiCarcasses.length} carcasses (ou lots) à inspecter:`,
    feiCarcasses
      .map(
        (carcasse) =>
          `-> ${carcasse.type === CarcasseType.PETIT_GIBIER ? `${carcasse.nombre_d_animaux} ` : ''}${
            carcasse.espece
          } (${carcasse.numero_bracelet})`,
      )
      .join('\n'),
    `Pour consulter la fiche, rendez-vous sur Zacharie : https://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${fei.numero}`,
    `Ce message a été généré automatiquement par l’application Zacharie. Si vous avez des questions sur cette saisie, merci de contacter l’établissement où a été effectuée l’inspection.`,
  ];
  const object = `L’établissement ${currentEntity?.nom_d_usage} vous a transmis une fiche comprenant ${feiCarcasses.length} carcasses (ou lots) à inspecter:`;
  return [object, email.filter(Boolean).join('\n\n')];
}
