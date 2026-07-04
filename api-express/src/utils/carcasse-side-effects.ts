import {
  Carcasse,
  EntityRelationStatus,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  IPM2Decision,
  User,
  UserRoles,
} from '@prisma/client';
import prisma from '~/prisma';
import sendNotificationToUser from '~/service/notifications';
import {
  formatCarcasseManquanteOrRefusChasseurEmail,
  formatManualValidationSviChasseurEmail,
  formatRenvoiExpediteurEmail,
  formatSaisieChasseurEmail,
  formatSviAssignedEmail,
} from '~/utils/formatCarcasseEmail';
import { checkGenerateCertificat } from '~/utils/generate-certificats';
import { isCarcasseDone } from '~/utils/is-carcasse-done';
import { sendWebhook } from '~/utils/api';
import {
  updateBrevoChasseurDeal,
  updateBrevoETGDealPremiereFiche,
  updateBrevoSVIDealPremiereFiche,
} from '~/third-parties/brevo';
import { getFichePdf } from '~/templates/get-fiche-pdf';

async function notifyExaminateurAndPremierDetenteur(
  fei_numero: string,
  title: string,
  email: string,
  notificationLogAction: string
) {
  const [examinateurInitial, premierDetenteur] = await prisma.fei
    .findUnique({
      where: { numero: fei_numero },
      include: {
        FeiExaminateurInitialUser: true,
        FeiPremierDetenteurUser: true,
      },
    })
    .then((fei) => {
      return [fei?.FeiExaminateurInitialUser, fei?.FeiPremierDetenteurUser];
    });

  await sendNotificationToUser({
    user: examinateurInitial!,
    title,
    body: email,
    email,
    notificationLogAction,
  });

  if (premierDetenteur?.id !== examinateurInitial?.id) {
    await sendNotificationToUser({
      user: premierDetenteur!,
      title,
      body: email,
      email,
      notificationLogAction,
    });
  }
}

export async function trackFirstFeiTreated(
  existingCarcasse: Carcasse,
  updatedCarcasse: Carcasse,
  user: User
) {
  if (user.at_least_one_fei_treated) return;

  if (user.roles.includes(UserRoles.CHASSEUR)) {
    if (updatedCarcasse.examinateur_initial_user_id === user.id) {
      if (updatedCarcasse.examinateur_initial_date_approbation_mise_sur_le_marche) {
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            at_least_one_fei_treated: updatedCarcasse.examinateur_initial_date_approbation_mise_sur_le_marche,
          },
        });
        await updateBrevoChasseurDeal(updatedUser);
      }
    } else if (updatedCarcasse.premier_detenteur_user_id === user.id) {
      if (updatedCarcasse.current_owner_user_id !== user.id) {
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: { at_least_one_fei_treated: updatedCarcasse.updated_at },
        });
        await updateBrevoChasseurDeal(updatedUser);
      }
    }
  }
}

export async function trackEtgFirstFei(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    existingCarcasse.current_owner_role === FeiOwnerRole.ETG &&
    updatedCarcasse.current_owner_role !== FeiOwnerRole.ETG
  ) {
    const etg = await prisma.entity.findUnique({
      where: {
        id: existingCarcasse.current_owner_entity_id,
        deleted_at: null,
      },
    });
    if (etg?.type === EntityTypes.ETG) {
      if (!etg.at_least_one_fei_treated) {
        await updateBrevoETGDealPremiereFiche(etg);
      }
    }
  }
}

export async function notifySaisieChasseur(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    existingCarcasse.svi_ipm2_decision !== updatedCarcasse.svi_ipm2_decision &&
    (updatedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE ||
      updatedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE)
  ) {
    const [object, email] = formatSaisieChasseurEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_SAISIE_${updatedCarcasse.zacharie_carcasse_id}`
    );
  }
}

export async function notifyManquanteChasseur(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    !existingCarcasse.intermediaire_carcasse_manquante &&
    updatedCarcasse.intermediaire_carcasse_manquante
  ) {
    const [object, email] = await formatCarcasseManquanteOrRefusChasseurEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_MANQUANTE_${updatedCarcasse.zacharie_carcasse_id}`
    );
  }
}

export async function notifyRefusChasseur(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (
    !existingCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
    updatedCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
    updatedCarcasse.intermediaire_carcasse_refus_motif
  ) {
    const [object, email] = await formatCarcasseManquanteOrRefusChasseurEmail(updatedCarcasse);
    await notifyExaminateurAndPremierDetenteur(
      existingCarcasse.fei_numero,
      object,
      email,
      `CARCASSE_REFUS_${updatedCarcasse.zacharie_carcasse_id}`
    );
  }
}

// Quand un destinataire (ETG ou collecteur) clique sur « Renvoyer à l'expéditeur », le next_owner
// de ses carcasses est vidé alors que le current_owner reste inchangé (l'expéditeur). On détecte ce
// cas — distinct d'une prise en charge, où le current_owner devient le destinataire — et on notifie
// l'expéditeur. Le renvoi touche un lot de carcasses ; la dédup notificationLog sur une action par
// (fiche, destinataire qui renvoie) garantit une seule notification.
export async function notifyRenvoiExpediteur(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  const isRenvoi =
    !!existingCarcasse.next_owner_role &&
    !updatedCarcasse.next_owner_role &&
    !!updatedCarcasse.current_owner_user_id &&
    existingCarcasse.current_owner_user_id === updatedCarcasse.current_owner_user_id &&
    existingCarcasse.current_owner_role === updatedCarcasse.current_owner_role;
  if (!isRenvoi) return;

  const expediteur = await prisma.user.findUnique({
    where: { id: updatedCarcasse.current_owner_user_id! },
  });
  if (!expediteur) return;

  const fei = await prisma.fei.findUnique({ where: { numero: updatedCarcasse.fei_numero } });
  if (!fei) return;

  const renvoyeurName =
    existingCarcasse.next_owner_entity_name_cache || existingCarcasse.next_owner_user_name_cache || null;
  const action = `FEI_RENVOYEE_${updatedCarcasse.fei_numero}_${existingCarcasse.next_owner_entity_id ?? existingCarcasse.next_owner_user_id}`;

  const [object, email] = formatRenvoiExpediteurEmail(
    fei,
    updatedCarcasse.current_owner_role!,
    renvoyeurName,
    updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache
  );
  await sendNotificationToUser({
    user: expediteur,
    title: object,
    body: email,
    email,
    notificationLogAction: action,
  });
}

export async function checkCertificat(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (updatedCarcasse.svi_ipm1_date || updatedCarcasse.svi_ipm2_date) {
    await checkGenerateCertificat(existingCarcasse, updatedCarcasse);
  }
}

// La clôture vit désormais par carcasse. Quand une carcasse vient d'être close au SVI ET que
// TOUTES les carcasses de la FEI sont terminales, on :
//   1. maintient le cache FEI Fei.svi_closed_at (consommé par les vues matérialisées et l'API
//      publique v1, qui ne lisent pas la clôture par carcasse) — pendant manuel de la clôture
//      auto qui écrit Fei.automatic_closed_at dans le cron ;
//   2. notifie examinateur + premier détenteur.
// Idempotent : l'écriture FEI est gardée par `!fei.svi_closed_at`, la notif/webhook par
// notificationLog (les carcasses sont persistées avant les side-effects, donc plusieurs d'entre
// elles peuvent voir "toutes terminales" dans le même lot).
export async function closeFeiAndNotifyChasseurOnSviCarcasseClose(
  existingCarcasse: Carcasse,
  updatedCarcasse: Carcasse
) {
  if (existingCarcasse.svi_closed_at || !updatedCarcasse.svi_closed_at) {
    return;
  }
  const carcasses = await prisma.carcasse.findMany({
    where: {
      fei_numero: updatedCarcasse.fei_numero,
      premier_detenteur_prochain_detenteur_id_cache:
        updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache,
    },
  });
  if (!carcasses.every(isCarcasseDone)) return;

  const action = `FEI_MANUAL_CLOSED_${updatedCarcasse.fei_numero}_${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}`;
  const examinateur = await prisma.user.findUnique({
    where: { id: updatedCarcasse.examinateur_initial_user_id },
  });
  if (examinateur) {
    const already = await prisma.notificationLog.findFirst({
      where: { user_id: updatedCarcasse.examinateur_initial_user_id, action, deleted_at: null },
    });
    if (already) return;
  }

  const [object, email] = await formatManualValidationSviChasseurEmail(updatedCarcasse.fei_numero, carcasses);
  const notification = { title: object, body: email, email, notificationLogAction: action };

  if (examinateur) {
    await sendNotificationToUser({ user: examinateur, ...notification });
    await sendWebhook(examinateur.id, 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }

  if (updatedCarcasse.premier_detenteur_user_id !== examinateur?.id) {
    const premierDetenteur = await prisma.user.findUnique({
      where: { id: updatedCarcasse.premier_detenteur_user_id },
    });
    await sendNotificationToUser({ user: premierDetenteur, ...notification });
    await sendWebhook(premierDetenteur.id, 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }
}

export async function webhookOwnerChange(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (existingCarcasse.current_owner_role !== updatedCarcasse.current_owner_role) {
    await sendWebhook(existingCarcasse.current_owner_user_id!, 'CARCASSE_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }
}

export async function notifySviAssignment(
  existingCarcasse: Carcasse,
  updatedCarcasse: Carcasse
): Promise<boolean> {
  if (
    existingCarcasse.next_owner_role === FeiOwnerRole.SVI ||
    updatedCarcasse.next_owner_role !== FeiOwnerRole.SVI
  ) {
    return false;
  }

  const sviUsers = await prisma.user.findMany({
    where: {
      roles: { has: UserRoles.SVI },
      EntityAndUserRelations: {
        some: {
          entity_id: updatedCarcasse.svi_entity_id!,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: {
            in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
          },
        },
      },
    },
  });
  for (const sviUser of sviUsers) {
    const [object, email] = await formatSviAssignedEmail(updatedCarcasse);
    await sendNotificationToUser({
      user: sviUser,
      title: object,
      body: email,
      email: email,
      notificationLogAction: `FEI_ASSIGNED_TO_${updatedCarcasse.next_owner_role}_${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}_${updatedCarcasse.fei_numero}`,
    });
  }

  const svi = await prisma.entity.findUnique({
    where: {
      deleted_at: null,
      id: updatedCarcasse.current_owner_entity_id,
    },
  });
  if (svi?.type === EntityTypes.SVI) {
    if (!svi.at_least_one_fei_treated) {
      await updateBrevoSVIDealPremiereFiche(svi);
    }
  }

  await sendWebhook(updatedCarcasse.examinateur_initial_user_id, 'CARCASSE_ASSIGNEE_AU_SVI', {
    carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
  });
  if (updatedCarcasse.examinateur_initial_user_id !== updatedCarcasse.premier_detenteur_user_id) {
    await sendWebhook(updatedCarcasse.premier_detenteur_user_id, 'CARCASSE_ASSIGNEE_AU_SVI', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }

  return true;
}

export async function notifyCircuitCourt(
  existingCarcasse: Carcasse,
  updatedCarcasse: Carcasse,
  user: User
): Promise<boolean> {
  if (existingCarcasse.next_owner_role === updatedCarcasse.next_owner_role) {
    return false;
  }

  const circuitCourtRoles: Array<FeiOwnerRole> = [
    FeiOwnerRole.COMMERCE_DE_DETAIL,
    FeiOwnerRole.CANTINE_OU_RESTAURATION_COLLECTIVE,
    FeiOwnerRole.ASSOCIATION_CARITATIVE,
    FeiOwnerRole.REPAS_DE_CHASSE_OU_ASSOCIATIF,
    FeiOwnerRole.CONSOMMATEUR_FINAL,
  ];
  if (!circuitCourtRoles.includes(updatedCarcasse.next_owner_role)) {
    return false;
  }

  const usersWorkingForEntity = (
    await prisma.entityAndUserRelations.findMany({
      where: {
        entity_id: updatedCarcasse.next_owner_entity_id!,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: {
          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
        },
        deleted_at: null,
      },
      include: {
        UserRelatedWithEntity: {
          select: {
            id: true,
            web_push_tokens: true,
            native_push_tokens: true,
            notifications: true,
            prenom: true,
            nom_de_famille: true,
            email: true,
          },
        },
      },
    })
  ).map((relation) => relation.UserRelatedWithEntity);

  const carcasses = await prisma.carcasse.findMany({
    where: {
      fei_numero: updatedCarcasse.fei_numero,
      premier_detenteur_prochain_detenteur_id_cache:
        updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache,
      deleted_at: null,
    },
  });

  for (const nextOwner of usersWorkingForEntity) {
    if (nextOwner.id !== user.id) {
      const email = [
        `Bonjour,`,
        `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Vous trouverez un résumé en pièce jointe, à conserver pour votre enregistrement.`,
        `Pour consulter la fiche, rendez-vous sur Zacharie avec votre email ${nextOwner.email} : https://zacharie.beta.gouv.fr/app/circuit-court/fei/${updatedCarcasse.fei_numero}/${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}`,
        `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
      ].join('\n\n');
      await sendNotificationToUser({
        user: nextOwner as User,
        title: `${user.prenom} ${user.nom_de_famille} vous a attribué une fiche d'examen initial du gibier sauvage n° ${updatedCarcasse?.fei_numero}`,
        body: email,
        email: email,
        notificationLogAction: `FEI_ASSIGNED_TO_${updatedCarcasse.next_owner_role}_${updatedCarcasse.fei_numero}_${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}`,
        attachments: [
          {
            content: await getFichePdf(updatedCarcasse, carcasses),
            name: `${updatedCarcasse.fei_numero}.pdf`,
          },
        ],
      });
    }
  }

  const examinateur = await prisma.user.findUnique({
    where: { id: updatedCarcasse.examinateur_initial_user_id },
  });
  if (examinateur) {
    await sendWebhook(examinateur.id, 'CARCASSE_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }
  if (updatedCarcasse.premier_detenteur_user_id !== examinateur?.id) {
    const premierDetenteur = await prisma.user.findUnique({
      where: { id: updatedCarcasse.premier_detenteur_user_id },
    });
    await sendWebhook(premierDetenteur.id, 'CARCASSE_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }

  const allInCircuitCourt =
    carcasses.length > 0 &&
    carcasses.every((c) => {
      const role = c.next_owner_role ?? c.current_owner_role;
      return role != null && circuitCourtRoles.includes(role);
    });
  if (allInCircuitCourt) {
    await prisma.carcasse.updateMany({
      where: {
        fei_numero: updatedCarcasse.fei_numero,
        premier_detenteur_prochain_detenteur_id_cache:
          updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache,
        deleted_at: null,
      },
      data: { svi_automatic_closed_at: new Date() },
    });
  }

  return true;
}

export async function notifyNextOwnerUser(existingCarcasse: Carcasse, updatedCarcasse: Carcasse, user: User) {
  const nextOwnerId = updatedCarcasse.next_owner_user_id;
  if (!nextOwnerId || nextOwnerId === existingCarcasse.next_owner_user_id) {
    return;
  }

  if (nextOwnerId !== user.id) {
    const nextOwner = await prisma.user.findUnique({
      where: { id: nextOwnerId },
    });
    const role = nextOwner?.roles[0];
    let url = 'https://zacharie.beta.gouv.fr/app/';
    if (role === UserRoles.CHASSEUR) url += 'chasseur/';
    else if (role === UserRoles.SVI) url += 'svi/';
    else if (role === UserRoles.ETG) url += 'etg/';
    else if (role === UserRoles.COLLECTEUR_PRO) url += 'collecteur-pro/';
    else {
      throw new Error(`Unknown role in notifying next owner user: ${role}`);
    }
    url += `fei/${updatedCarcasse.fei_numero}`;
    if (role !== UserRoles.CHASSEUR)
      url += `/${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}`;

    const email = [
      `Bonjour,`,
      `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
      `Pour consulter la fiche, rendez-vous sur Zacharie : ${url}`,
      `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
    ].join('\n\n');
    await sendNotificationToUser({
      user: nextOwner!,
      title: `${user.prenom} ${user.nom_de_famille} vous a attribué la fiche ${updatedCarcasse?.fei_numero}`,
      body: email,
      email: email,
      notificationLogAction: `FEI_ASSIGNED_TO_${updatedCarcasse.next_owner_role}_${updatedCarcasse?.fei_numero}_${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}`,
    });
  } else {
    console.log('next owner is the same user', nextOwnerId, user.id);
  }

  if (existingCarcasse.next_owner_user_id) {
    console.log('need to send notification remove fiche');
    const exNextOwner = await prisma.user.findUnique({
      where: { id: existingCarcasse.next_owner_user_id },
    });
    const email = [
      `Bonjour,`,
      `${user.prenom} ${user.nom_de_famille} vous avait attribué par erreur la fiche d'examen initial n° ${existingCarcasse?.fei_numero}.`,
      'Cette erreur vient d\u2019être corrigée : vous n\u2019êtes plus destinataire de cette fiche.',
      `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
    ].join('\n\n');
    await sendNotificationToUser({
      user: exNextOwner!,
      title: `La fiche n° ${existingCarcasse?.fei_numero} ne vous est plus attribuée`,
      body: email,
      email: email,
      notificationLogAction: `FEI_REMOVED_FROM_${updatedCarcasse.next_owner_role}_${updatedCarcasse?.fei_numero}_${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}`,
    });
  }
}

export async function notifyNextOwnerEntity(
  existingCarcasse: Carcasse,
  updatedCarcasse: Carcasse,
  user: User
) {
  if (
    !updatedCarcasse.next_owner_entity_id ||
    updatedCarcasse.next_owner_entity_id === existingCarcasse.next_owner_entity_id
  ) {
    return;
  }

  const usersWorkingForEntity = (
    await prisma.entityAndUserRelations.findMany({
      where: {
        entity_id: updatedCarcasse.next_owner_entity_id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: {
          in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
        },
        deleted_at: null,
      },
      include: {
        UserRelatedWithEntity: {
          select: {
            id: true,
            web_push_tokens: true,
            native_push_tokens: true,
            notifications: true,
            prenom: true,
            nom_de_famille: true,
            roles: true,
            email: true,
          },
        },
      },
    })
  ).map((relation) => relation.UserRelatedWithEntity);

  for (const nextOwner of usersWorkingForEntity) {
    if (nextOwner.id !== user.id) {
      const role = nextOwner?.roles[0];
      let url = 'https://zacharie.beta.gouv.fr/app/';
      if (role === UserRoles.CHASSEUR) url += 'chasseur/';
      else if (role === UserRoles.SVI) url += 'svi/';
      else if (role === UserRoles.ETG) url += 'etg/';
      else if (role === UserRoles.COLLECTEUR_PRO) url += 'collecteur-pro/';
      else {
        throw new Error(`Unknown role in notifying next owner entity: ${role}`);
      }
      url += `fei/${updatedCarcasse.fei_numero}`;
      if (role !== UserRoles.CHASSEUR)
        url += `/${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}`;

      const email = [
        `Bonjour,`,
        `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
        `Pour consulter la fiche, rendez-vous sur Zacharie : ${url}`,
        `Ce message a été généré automatiquement par l'application Zacharie. Si vous avez des questions sur l'attribution de cette fiche, n'hésitez pas à contacter la personne qui vous l'a envoyée.`,
      ].join('\n\n');
      await sendNotificationToUser({
        user: nextOwner as User,
        title: `${user.prenom} ${user.nom_de_famille} vous a attribué la fiche ${updatedCarcasse?.fei_numero}`,
        body: email,
        email: email,
        notificationLogAction: `FEI_ASSIGNED_TO_${updatedCarcasse.next_owner_role}_${updatedCarcasse.fei_numero}_${updatedCarcasse.premier_detenteur_prochain_detenteur_id_cache}`,
      });
    }
  }

  const examinateur = await prisma.user.findUnique({
    where: { id: updatedCarcasse.examinateur_initial_user_id },
  });
  if (examinateur) {
    await sendWebhook(examinateur.id, 'CARCASSE_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }
  if (updatedCarcasse.premier_detenteur_user_id !== examinateur?.id) {
    const premierDetenteur = await prisma.user.findUnique({
      where: { id: updatedCarcasse.premier_detenteur_user_id },
    });
    await sendWebhook(premierDetenteur.id, 'CARCASSE_ASSIGNEE_AU_PROCHAIN_DETENTEUR', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }
}

export async function webhookIntermediaireClose(existingCarcasse: Carcasse, updatedCarcasse: Carcasse) {
  if (existingCarcasse.intermediaire_closed_at || !updatedCarcasse.intermediaire_closed_at) {
    return;
  }

  const examinateur = await prisma.user.findUnique({
    where: { id: updatedCarcasse.examinateur_initial_user_id },
  });
  if (examinateur) {
    await sendWebhook(examinateur.id, 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }
  if (updatedCarcasse.premier_detenteur_user_id !== examinateur?.id) {
    const premierDetenteur = await prisma.user.findUnique({
      where: { id: updatedCarcasse.premier_detenteur_user_id },
    });
    await sendWebhook(premierDetenteur.id, 'CARCASSE_CLOTUREE', {
      carcasseZacharieId: updatedCarcasse.zacharie_carcasse_id,
    });
  }
}

export async function runCarcasseUpdateSideEffects(
  existingCarcasse: Carcasse,
  updatedCarcasse: Carcasse,
  user: User
) {
  await trackFirstFeiTreated(existingCarcasse, updatedCarcasse, user);
  await trackEtgFirstFei(existingCarcasse, updatedCarcasse);
  await notifySaisieChasseur(existingCarcasse, updatedCarcasse);
  await notifyManquanteChasseur(existingCarcasse, updatedCarcasse);
  await notifyRefusChasseur(existingCarcasse, updatedCarcasse);
  await notifyRenvoiExpediteur(existingCarcasse, updatedCarcasse);
  await closeFeiAndNotifyChasseurOnSviCarcasseClose(existingCarcasse, updatedCarcasse);
  await checkCertificat(existingCarcasse, updatedCarcasse);

  const handledBySvi = await notifySviAssignment(existingCarcasse, updatedCarcasse);
  if (handledBySvi) return;

  const handledByCircuitCourt = await notifyCircuitCourt(existingCarcasse, updatedCarcasse, user);
  if (handledByCircuitCourt) return;

  await notifyNextOwnerUser(existingCarcasse, updatedCarcasse, user);
  await notifyNextOwnerEntity(existingCarcasse, updatedCarcasse, user);
  await webhookIntermediaireClose(existingCarcasse, updatedCarcasse);
}
